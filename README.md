# Podcast Pitch Platform

> An MVP platform for generating and sending personalized podcast guest pitches at scale.

## Architecture

- **Frontend**: Next.js app deployed to Cloud Run
- **Backend API**: Node.js/Express API deployed to Cloud Run
- **Worker**: Node.js worker for async email processing deployed to Cloud Run
- **Database**: Cloud SQL PostgreSQL 15+
- **Queue**: Cloud Tasks for async job processing
- **Auth**: Google Identity Platform (OAuth + email/password)

## Project Structure

```
podcast-pitch-platform/
├── frontend/        # Next.js app
├── backend/         # API + worker logic
├── shared/          # Shared types, schemas, constants
├── infra/           # Terraform (optional)
├── docs/
│   ├── architecture.md
│   ├── data-model.md
│   └── deployment.md
└── README.md
```

## Getting Started

### Prerequisites

- Node.js 20+
- pnpm 8+
- PostgreSQL 15+ (local or Cloud SQL)
- GCP Project (for production)

### Local Development

1. **Clone and install dependencies:**
   ```bash
   pnpm install
   ```

2. **Set up environment variables:**
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

3. **Run database migrations:**
   ```bash
   cd backend && pnpm db:migrate
   ```

4. **Start development servers:**
   ```bash
   # Terminal 1: Backend API
   cd backend && pnpm dev

   # Terminal 2: Worker
   cd backend && pnpm dev:worker

   # Terminal 3: Frontend
   cd frontend && pnpm dev
   ```

## Environment Variables

See `.env.example` for required environment variables.

## Deployment

The application is deployed via GitHub Actions to GCP Cloud Run. See [docs/deployment.md](docs/deployment.md) for details.

### Manual Deployment

```bash
# Build and deploy all services
./scripts/deploy.sh [dev|staging|prod]
```



##cloudshell commands 
# Set project
PROJECT_ID="abstract-hydra-477523-q7"
gcloud config set project $PROJECT_ID

# 1. Create Service Account
gcloud iam service-accounts create github-deployer \
  --display-name="GitHub Actions Deployer"

# 2. Grant IAM Roles
SA_EMAIL="github-deployer@${PROJECT_ID}.iam.gserviceaccount.com"
for role in roles/run.admin roles/iam.serviceAccountUser roles/artifactregistry.writer roles/secretmanager.secretAccessor; do
  gcloud projects add-iam-policy-binding $PROJECT_ID --member="serviceAccount:$SA_EMAIL" --role="$role"
done

# 3. Create Workload Identity Pool & Provider
PROJECT_NUMBER=$(gcloud projects describe $PROJECT_ID --format='value(projectNumber)')
gcloud iam workload-identity-pools create github-pool --location=global --display-name="GitHub Pool"
gcloud iam workload-identity-pools providers create-oidc github-provider \
  --location=global --workload-identity-pool=github-pool \
  --display-name="GitHub Provider" \
  --attribute-mapping="google.subject=assertion.sub,attribute.repository=assertion.repository" \
  --issuer-uri="https://token.actions.githubusercontent.com"

# 4. Allow GitHub repo to use service account
gcloud iam service-accounts add-iam-policy-binding $SA_EMAIL \
  --role="roles/iam.workloadIdentityUser" \
  --member="principalSet://iam.googleapis.com/projects/${PROJECT_NUMBER}/locations/global/workloadIdentityPools/github-pool/attribute.repository/upalchowdhury/podcastpitch"

# 5. Create VPC Connector
gcloud compute networks vpc-access connectors create podcast-pitch-connector \
  --region=us-central1 --range=10.8.0.0/28

# 6. Create Secrets
echo -n "postgresql://postgres:podcastpitch@/podcastpitch?host=/cloudsql/${PROJECT_ID}:us-central1:podcastpitch" | \
  gcloud secrets create podcast-pitch-db-url-prod --data-file=-
echo -n "GENERATE_A_SECURE_JWT_SECRET_HERE" | gcloud secrets create podcast-pitch-jwt-secret-prod --data-file=-

# 7. Print values for GitHub Secrets
echo "===== ADD THESE TO GITHUB SECRETS ====="
echo "GCP_PROJECT_ID: $PROJECT_ID"
echo "GCP_SERVICE_ACCOUNT: $SA_EMAIL"
echo "GCP_WORKLOAD_IDENTITY_PROVIDER: projects/${PROJECT_NUMBER}/locations/global/workloadIdentityPools/github-pool/providers/github-provider"

---------FIX-----------
PROJECT_ID="abstract-hydra-477523-q7"
PROJECT_NUMBER="906706486339"

gcloud iam workload-identity-pools providers create-oidc github-provider \
  --location=global \
  --workload-identity-pool=github-pool \
  --display-name="GitHub Provider" \
  --attribute-mapping="google.subject=assertion.sub,attribute.actor=assertion.actor,attribute.repository=assertion.repository,attribute.repository_owner=assertion.repository_owner" \
  --attribute-condition="assertion.repository_owner=='upalchowdhury'" \
  --issuer-uri="https://token.actions.githubusercontent.com"



gcloud services enable run.googleapis.com --project=abstract-hydra-477523-q7

gcloud projects add-iam-policy-binding abstract-hydra-477523-q7 \
  --member="serviceAccount:906706486339-compute@developer.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor"


# Replace YOUR_GEMINI_API_KEY with your actual Gemini API key
echo -n "YOUR_GEMINI_API_KEY" | gcloud secrets create podcast-pitch-gemini-key --data-file=- --project=abstract-hydra-477523-q7

gcloud services enable sqladmin.googleapis.com --project=abstract-hydra-477523-q7
https://aistudio.google.com/app/apikey




# 1. Import podcasts (~800+)
gcloud run jobs execute podcast-import-job --region us-central1

# 2. Enrich with RSS feeds (episodes, emails)
gcloud run jobs execute podcast-rss-job --region us-central1

# 3. Discover contact emails via web crawling
gcloud run jobs execute podcast-contacts-job --region us-central1

echo -n "TJWZJKN9PQ98VUGKAKQJ" | gcloud secrets versions add podcast-pitch-podcastindex-key --data-file=- --project=abstract-hydra-477523-q7

echo -n "MqGbXtmNMXtwdqkjS6Be^DhS" | gcloud secrets versions add podcast-pitch-podcastindex-secret --data-file=- --project=abstract-hydra-477523-q7

## License

Proprietary - All rights reserved






My Recommendation for MVP
A focused enhancement that adds significant value with minimal complexity:

sql
-- 1. Add pg_trgm index for fuzzy host/title matching
CREATE INDEX podcasts_title_trgm_idx ON podcasts USING gin (title gin_trgm_ops);
CREATE INDEX podcasts_host_name_trgm_idx ON podcasts USING gin (host_name gin_trgm_ops);
-- 2. Add proper FTS index on description (you have searchVector but not using it)
CREATE INDEX podcasts_search_idx ON podcasts USING gin (to_tsvector('english', COALESCE(title, '') || ' ' || COALESCE(description, '')));
Then update ranking to:

ts
.orderBy(
    desc(podcasts.listenScore),
    desc(podcasts.latestEpisodePubDate),  // Recency boost
    desc(podcasts.audienceSizeEstimate)
)
Questions for You
Trigram search - Do you want me to implement fuzzy matching so users can find "Tim Ferris" even if they type "Tim Faris"?
Recency boost - How aggressive should recency weighting be? E.g., should podcasts with episodes in the last 30 days rank higher than those with higher listen scores but inactive for 6 months?
"Why" evidence - Is this important for your pitch workflow? (e.g., "Matched: 3 episodes about AI in last month, host interviewed AI founders")
Would you like me to create an implementation plan for the MVP search improvements, or is this analysis sufficient for now?