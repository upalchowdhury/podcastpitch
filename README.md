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

## License

Proprietary - All rights reserved
