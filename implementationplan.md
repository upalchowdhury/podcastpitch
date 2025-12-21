# Podcast Pitch Platform — MVP Technical Implementation Plan

> **Target:** GCP (Cloud Run + Cloud SQL PostgreSQL)
>
> **Audience:** AI Code Editors (Windsurf / Claude Code / Cursor / Copilot Workspace)
>
> **Important:** This document is an execution blueprint. **Do NOT add features not listed. Do NOT write code until structure is complete.**

---

## 0. Objective & Constraints

### Goal

Build an **MVP of the Podcast Pitch Platform** that:

* Fully satisfies the PRD requirements
* Runs entirely on **GCP Cloud Run** (no GKE)
* Uses **Cloud SQL PostgreSQL**
* Scales to millions of users without architectural rewrite

### Explicit Constraints

* ❌ No GKE
* ❌ No microservices explosion
* ❌ No CRM integrations
* ❌ No team/org features
* ❌ No A/B testing
* ❌ No Gmail/IMAP reply sync
* ✅ Async email sending via queue
* ✅ User-owned email infrastructure only (SMTP / Smartlead)

---

## 1. High-Level Architecture

### Runtime Components

1. **Frontend**: Next.js → Cloud Run
2. **Backend API**: Node.js → Cloud Run
3. **Worker**: Node.js (shared codebase) → Cloud Run
4. **Database**: Cloud SQL (PostgreSQL 15+)
5. **Queue**: Cloud Tasks
6. **Secrets**: Secret Manager
7. **Auth**: Google Identity Platform (OAuth + email/password)

---

## 2. Repository Structure (MANDATORY)

```
podcast-pitch-platform/
├── frontend/        # Next.js app
├── backend/         # API + worker logic
├── shared/          # Shared types, schemas, constants
├── infra/           # (optional) Terraform later
├── docs/
│   ├── architecture.md
│   ├── data-model.md
│   ├── deployment.md
└── README.md
```

⚠️ No microservices. Use **logical modules only**.

---

## 3. Environment Strategy

### Environments

* dev
* staging
* prod

Each environment must have:

* Separate Cloud SQL database
* Separate Cloud Run services
* Separate Cloud Tasks queues
* Separate Secret Manager entries

Environment selected via:

```
ENV=dev | staging | prod
```

---

## 4. Database Schema (Cloud SQL PostgreSQL)

### Users & Auth

* `users(id, email, auth_provider, created_at)`

### Profiles

* `user_profiles(user_id, name, bio, expertise_topics, target_audience, credentials, created_at)`

### Email Infrastructure

* `email_accounts(id, user_id, provider_type, encrypted_secret_ref, from_name, from_email, domain, health_status, is_verified)`

### Podcasts

* `podcasts(id, external_source, external_id, title, description, categories, language, host_name, contact_email, website, audience_size_estimate, updated_at)`

### Targeting

* `target_lists(id, user_id, name)`
* `target_list_items(list_id, podcast_id, added_at)`

  * UNIQUE(user_id, podcast_id)

### Pitching

* `pitches(id, user_id, podcast_id, generated_subject, generated_body, edited_subject, edited_body, status, prompt_version, created_at)`

### Sending Pipeline

* `send_jobs(id, pitch_id, scheduled_at, provider, status, attempts, last_error)`
* `send_events(send_job_id, event_type, timestamp, metadata)`

### Responses

* `responses(pitch_id, status, notes, updated_at)`

### Billing / Limits

* `tiers(user_id, tier_name, daily_limit, monthly_limit)`

---

## 5. Backend Modules (Logical)

Required modules:

* auth
* users
* profiles
* email_accounts
* podcasts
* target_lists
* pitches
* sending
* tracking
* billing_limits

All modules must:

* Validate input
* Enforce ownership
* Be idempotent where applicable

---

## 6. Podcast Data Ingestion

### Source

* Licensed dataset (ListenNotes / Podchaser equivalent)

### Ingestion

* Raw files → Cloud Storage
* Cloud Run Job:

  * Parse
  * Upsert into `podcasts`
  * Track import metadata

### Search

* PostgreSQL full-text search
* Filters: category, language, audience size

---

## 7. AI Pitch Generation

### Inputs

* User profile
* Podcast metadata
* Optional recent episodes

### Outputs

* Subject line
* Email body

### Requirements

* Store prompt version
* Allow regeneration
* Allow manual edits

---

## 8. Email Infrastructure

### Provider Interface

```
sendEmail(from, to, subject, html, text, headers)
```

### Providers

* SMTP (user-provided)
* Smartlead (optional)

### Security

* Store secrets in Secret Manager only
* DB stores references only

---

## 9. Domain Health Checks

### Checks

* SPF
* DKIM
* DMARC

### Behavior

* DNS lookup on connect
* Store results
* Warn user, do not block sending

---

## 10. Async Sending Pipeline

### Flow

1. User schedules send
2. API validates limits & duplicates
3. Create `send_jobs`
4. Enqueue Cloud Tasks
5. Worker sends + logs events

Never send email synchronously.

---

## 11. Tracking & Analytics

### Open Tracking

* Pixel: `/t/open?send_job_id=UUID`

### Responses

* Manual update
* States: interested, declined, booked, no_response

---

## 12. Rate Limiting & Abuse Prevention

* Daily send cap
* Monthly send cap
* Duplicate outreach prevention

Enforced at schedule time and send time.

---

## 13. Frontend Pages

1. Landing
2. Auth
3. Onboarding
4. Podcast Search
5. Podcast Detail
6. Target Lists
7. Pitch Editor
8. Send Scheduler
9. Dashboard
10. Response Tracker

---

## 14. Deployment (Cloud Run)

### Services

* frontend
* api
* worker

### Networking

* Serverless VPC Connector
* Private IP to Cloud SQL

### IAM

* API SA: Cloud SQL Client + Secret Access
* Worker SA: Same + Cloud Tasks Consumer

---

## 15. Observability

### Logs

* Structured JSON logs
* Include user_id, pitch_id, send_job_id

### Metrics

* Send success rate
* Queue depth
* Open rate

### Alerts

* Worker failures
* Queue backlog
* DB saturation

---

## 16. Execution Order

1. Auth + Profiles
2. Email connect + DNS checks
3. Podcast ingestion + search
4. Pitch generation
5. Async sending pipeline
6. Tracking dashboard
7. Hardening

---

## 17. Explicit Non-Goals (MVP)

* No GKE
* No CRM
* No Teams
* No A/B testing
* No Reply Sync

---

## 18. Final Rule

> Build boring, clean, modular infrastructure.
> No premature optimization.
> No feature creep.
> This MVP must survive production.
