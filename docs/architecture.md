# Architecture

## Overview

The Podcast Pitch Platform is a full-stack application designed to help podcast guests generate and send personalized pitch emails at scale.

## System Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                                 GCP Cloud                                    │
│                                                                             │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐                     │
│  │   Frontend  │    │   Backend   │    │   Worker    │                     │
│  │   (Next.js) │───▶│   (Express) │───▶│   (Node.js) │                     │
│  │  Cloud Run  │    │  Cloud Run  │    │  Cloud Run  │                     │
│  └─────────────┘    └──────┬──────┘    └──────┬──────┘                     │
│                            │                   │                            │
│                            ▼                   ▼                            │
│                     ┌─────────────┐    ┌─────────────┐                     │
│                     │  Cloud SQL  │    │ Cloud Tasks │                     │
│                     │ PostgreSQL  │    │   Queue     │                     │
│                     └─────────────┘    └─────────────┘                     │
│                                                                             │
│                     ┌─────────────┐    ┌─────────────┐                     │
│                     │   Secret    │    │   OpenAI    │                     │
│                     │   Manager   │    │    API      │                     │
│                     └─────────────┘    └─────────────┘                     │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Components

### Frontend (Next.js)
- **Location**: `/frontend`
- **Port**: 3000
- **Responsibilities**:
  - User interface for all features
  - Server-side rendering for SEO
  - Client-side state management with Zustand
  - API communication via SWR/fetch

### Backend API (Express)
- **Location**: `/backend/src/api`
- **Port**: 3001
- **Responsibilities**:
  - RESTful API endpoints
  - Authentication (JWT)
  - Business logic
  - Database operations

### Worker (Node.js)
- **Location**: `/backend/src/worker`
- **Port**: 3002
- **Responsibilities**:
  - Processing Cloud Tasks jobs
  - Sending emails asynchronously
  - Recording tracking events

### Database (Cloud SQL PostgreSQL)
- **Version**: PostgreSQL 15+
- **Responsibilities**:
  - User data storage
  - Podcast catalog
  - Pitch management
  - Sending queue

### Cloud Tasks
- **Queue**: email-send-queue
- **Responsibilities**:
  - Async email job processing
  - Retry logic
  - Rate limiting

### Secret Manager
- **Responsibilities**:
  - JWT secrets
  - SMTP credentials
  - API keys

## Data Flow

### Email Sending Flow
```
1. User schedules send via UI
2. API validates limits & duplicates
3. API creates send_job record
4. API enqueues Cloud Tasks job
5. Cloud Tasks triggers Worker
6. Worker sends email via SMTP
7. Worker logs send_event
8. Tracking pixel records opens
```

### AI Pitch Generation Flow
```
1. User selects podcast
2. API retrieves user profile + podcast data
3. API calls OpenAI with context
4. OpenAI returns subject + body
5. API stores pitch with prompt version
6. User can edit and regenerate
```

## Security

### Authentication
- JWT tokens with 7-day expiration
- Google OAuth integration
- Bcrypt password hashing (12 rounds)

### Authorization
- User-scoped data access
- Resource ownership validation
- Rate limiting per user

### Data Protection
- SMTP credentials in Secret Manager
- Database connection via VPC
- TLS in transit

## Environments

| Environment | Branch   | Database           | Purpose        |
|-------------|----------|--------------------|--------------  |
| dev         | feature  | podcast_pitch_dev  | Development    |
| staging     | staging  | podcast_pitch_stg  | Pre-production |
| prod        | main     | podcast_pitch_prod | Production     |

## Monitoring

### Logs
- Structured JSON logging via Pino
- Includes: user_id, pitch_id, send_job_id

### Metrics
- Cloud Run built-in metrics
- Custom: send success rate, queue depth, open rate

### Alerts
- Worker failures
- Queue backlog > 1000
- Database CPU > 80%
