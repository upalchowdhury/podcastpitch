# Deployment Guide

## Prerequisites

### GCP Resources Required

1. **GCP Project** with billing enabled
2. **Artifact Registry** repository for Docker images
3. **Cloud SQL** PostgreSQL 15+ instance
4. **VPC Connector** for Cloud Run → Cloud SQL
5. **Secret Manager** for storing secrets
6. **Cloud Tasks** queue for async jobs
7. **IAM Service Accounts** with appropriate roles

### GitHub Secrets Required

Configure these secrets in your GitHub repository:

| Secret                          | Description                              |
|---------------------------------|------------------------------------------|
| `GCP_PROJECT_ID`                | Your GCP project ID                      |
| `GCP_WORKLOAD_IDENTITY_PROVIDER`| Workload identity federation provider    |
| `GCP_SERVICE_ACCOUNT`           | Service account email for deployment     |

---

## Initial GCP Setup

### 1. Enable Required APIs

```bash
gcloud services enable \
  run.googleapis.com \
  sqladmin.googleapis.com \
  secretmanager.googleapis.com \
  cloudtasks.googleapis.com \
  artifactregistry.googleapis.com \
  vpcaccess.googleapis.com \
  compute.googleapis.com
```

### 2. Create Artifact Registry Repository

```bash
gcloud artifacts repositories create podcast-pitch \
  --repository-format=docker \
  --location=us-central1 \
  --description="Podcast Pitch Platform images"
```

### 3. Create Cloud SQL Instance

```bash
# Create instance
gcloud sql instances create podcast-pitch-db \
  --database-version=POSTGRES_15 \
  --tier=db-f1-micro \
  --region=us-central1 \
  --root-password=YOUR_ROOT_PASSWORD

# Create databases for each environment
gcloud sql databases create podcast_pitch_dev --instance=podcast-pitch-db
gcloud sql databases create podcast_pitch_stg --instance=podcast-pitch-db
gcloud sql databases create podcast_pitch_prod --instance=podcast-pitch-db

# Create user
gcloud sql users create app \
  --instance=podcast-pitch-db \
  --password=YOUR_APP_PASSWORD
```

### 4. Create VPC Connector

```bash
# Create VPC connector for Cloud Run
gcloud compute networks vpc-access connectors create podcast-pitch-connector \
  --region=us-central1 \
  --network=default \
  --range=10.8.0.0/28
```

### 5. Create Cloud Tasks Queue

```bash
gcloud tasks queues create email-send-queue \
  --location=us-central1 \
  --max-dispatches-per-second=10 \
  --max-concurrent-dispatches=100
```

### 6. Store Secrets

```bash
# Database URL for each environment
echo -n "postgresql://app:PASSWORD@/podcast_pitch_dev?host=/cloudsql/PROJECT:REGION:INSTANCE" | \
  gcloud secrets create podcast-pitch-db-url-dev --data-file=-

echo -n "postgresql://app:PASSWORD@/podcast_pitch_stg?host=/cloudsql/PROJECT:REGION:INSTANCE" | \
  gcloud secrets create podcast-pitch-db-url-staging --data-file=-

echo -n "postgresql://app:PASSWORD@/podcast_pitch_prod?host=/cloudsql/PROJECT:REGION:INSTANCE" | \
  gcloud secrets create podcast-pitch-db-url-prod --data-file=-

# JWT secrets
echo -n "your-jwt-secret-32-chars-minimum" | \
  gcloud secrets create podcast-pitch-jwt-secret-dev --data-file=-

echo -n "your-jwt-secret-32-chars-minimum" | \
  gcloud secrets create podcast-pitch-jwt-secret-staging --data-file=-

echo -n "your-jwt-secret-32-chars-minimum" | \
  gcloud secrets create podcast-pitch-jwt-secret-prod --data-file=-

# OpenAI API Key
echo -n "sk-your-openai-api-key" | \
  gcloud secrets create podcast-pitch-openai-key --data-file=-
```

### 7. Setup Workload Identity Federation

```bash
# Create service account
gcloud iam service-accounts create github-actions \
  --display-name="GitHub Actions Deployer"

# Grant permissions
gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:github-actions@$PROJECT_ID.iam.gserviceaccount.com" \
  --role="roles/run.admin"

gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:github-actions@$PROJECT_ID.iam.gserviceaccount.com" \
  --role="roles/artifactregistry.writer"

gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:github-actions@$PROJECT_ID.iam.gserviceaccount.com" \
  --role="roles/iam.serviceAccountUser"

# Create workload identity pool
gcloud iam workload-identity-pools create github-pool \
  --location="global" \
  --display-name="GitHub Pool"

gcloud iam workload-identity-pools providers create-oidc github-provider \
  --location="global" \
  --workload-identity-pool="github-pool" \
  --display-name="GitHub Provider" \
  --attribute-mapping="google.subject=assertion.sub,attribute.repository=assertion.repository" \
  --issuer-uri="https://token.actions.githubusercontent.com"

# Allow GitHub to impersonate service account
gcloud iam service-accounts add-iam-policy-binding \
  github-actions@$PROJECT_ID.iam.gserviceaccount.com \
  --role="roles/iam.workloadIdentityUser" \
  --member="principalSet://iam.googleapis.com/projects/$PROJECT_NUMBER/locations/global/workloadIdentityPools/github-pool/attribute.repository/YOUR_ORG/YOUR_REPO"
```

---

## Environment Configuration

### Development (.env.local)

```env
NODE_ENV=development
ENV=dev
DATABASE_URL=postgresql://postgres:password@localhost:5432/podcast_pitch
JWT_SECRET=dev-secret-change-in-production-32chars
OPENAI_API_KEY=sk-your-key
API_URL=http://localhost:3001
FRONTEND_URL=http://localhost:3000
```

### Production (via Secret Manager)

Secrets are injected into Cloud Run services at runtime. See the GitHub Actions workflow for configuration.

---

## CI/CD Pipeline

The GitHub Actions workflow (`.github/workflows/deploy.yml`) handles:

1. **Test & Lint**: Runs on all PRs and pushes
2. **Build**: Creates Docker images for API, Worker, Frontend
3. **Push**: Uploads images to Artifact Registry
4. **Deploy**: Deploys to Cloud Run

### Deployment Flow

```
Push to staging → Deploy to staging environment
Push to main → Deploy to production environment
```

### Manual Deployment

To deploy manually:

```bash
# Set environment
export ENV=dev  # or staging, prod
export PROJECT_ID=your-project-id

# Build images
docker build -f backend/Dockerfile -t api .
docker build -f backend/Dockerfile.worker -t worker .
docker build -f frontend/Dockerfile -t frontend .

# Tag and push
docker tag api us-central1-docker.pkg.dev/$PROJECT_ID/podcast-pitch/api:latest
docker push us-central1-docker.pkg.dev/$PROJECT_ID/podcast-pitch/api:latest

# Deploy to Cloud Run
gcloud run deploy podcast-pitch-api \
  --image us-central1-docker.pkg.dev/$PROJECT_ID/podcast-pitch/api:latest \
  --region us-central1 \
  --platform managed
```

---

## Database Migrations

Run migrations before deploying new versions:

```bash
# Connect to database
gcloud sql connect podcast-pitch-db --user=app

# Or run migration script
cd backend
DATABASE_URL="your-connection-string" pnpm db:migrate
```

---

## Monitoring

### View Logs

```bash
# API logs
gcloud logging read "resource.type=cloud_run_revision AND resource.labels.service_name=podcast-pitch-api" --limit 100

# Worker logs
gcloud logging read "resource.type=cloud_run_revision AND resource.labels.service_name=podcast-pitch-worker" --limit 100
```

### View Metrics

Access Cloud Run metrics in the GCP Console:
- Request latency
- Container instances
- Memory usage
- CPU utilization

---

## Troubleshooting

### Common Issues

1. **Database connection fails**
   - Check VPC connector is attached
   - Verify Cloud SQL instance is running
   - Confirm database URL secret is correct

2. **Secret access denied**
   - Grant `roles/secretmanager.secretAccessor` to Cloud Run service account

3. **Images fail to push**
   - Run `gcloud auth configure-docker us-central1-docker.pkg.dev`
   - Check Artifact Registry permissions

4. **Cloud Tasks not triggering worker**
   - Verify worker URL is correct
   - Check IAM permissions for Cloud Tasks
