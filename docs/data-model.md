# Data Model

## Entity Relationship Diagram

```
┌───────────────┐       ┌───────────────┐       ┌───────────────┐
│     users     │       │ user_profiles │       │  user_tiers   │
├───────────────┤       ├───────────────┤       ├───────────────┤
│ id (PK)       │──────▶│ user_id (PK)  │       │ user_id (PK)  │
│ email         │       │ name          │       │ tier_name     │
│ password_hash │       │ bio           │       │ daily_limit   │
│ auth_provider │       │ expertise_topics│     │ monthly_limit │
│ created_at    │       │ target_audience│      │ created_at    │
└───────────────┘       │ credentials   │       │ updated_at    │
        │               │ created_at    │       └───────────────┘
        │               │ updated_at    │
        │               └───────────────┘
        │
        │       ┌───────────────┐       ┌───────────────┐
        ├──────▶│ email_accounts│       │   podcasts    │
        │       ├───────────────┤       ├───────────────┤
        │       │ id (PK)       │       │ id (PK)       │
        │       │ user_id (FK)  │       │ external_source│
        │       │ provider_type │       │ external_id   │
        │       │ from_name     │       │ title         │
        │       │ from_email    │       │ description   │
        │       │ domain        │       │ categories    │
        │       │ health_status │       │ language      │
        │       │ is_verified   │       │ host_name     │
        │       └───────────────┘       │ contact_email │
        │                               │ website       │
        │       ┌───────────────┐       │ audience_size │
        ├──────▶│ target_lists  │       └───────┬───────┘
        │       ├───────────────┤               │
        │       │ id (PK)       │               │
        │       │ user_id (FK)  │               │
        │       │ name          │               │
        │       └───────┬───────┘               │
        │               │                       │
        │               ▼                       │
        │       ┌───────────────────┐           │
        │       │ target_list_items │           │
        │       ├───────────────────┤           │
        │       │ list_id (PK, FK)  │───────────┤
        │       │ podcast_id (PK,FK)│◀──────────┘
        │       │ added_at          │
        │       └───────────────────┘
        │
        │       ┌───────────────┐       ┌───────────────┐
        └──────▶│    pitches    │       │   podcasts    │
                ├───────────────┤       ├───────────────┤
                │ id (PK)       │──────▶│ id            │
                │ user_id (FK)  │       └───────────────┘
                │ podcast_id(FK)│
                │ generated_subj│       ┌───────────────┐
                │ generated_body│◀─────│   responses   │
                │ edited_subject│       ├───────────────┤
                │ edited_body   │       │ id (PK)       │
                │ status        │       │ pitch_id (FK) │
                │ prompt_version│       │ status        │
                │ created_at    │       │ notes         │
                │ updated_at    │       │ updated_at    │
                └───────┬───────┘       └───────────────┘
                        │
                        ▼
                ┌───────────────┐       ┌───────────────┐
                │   send_jobs   │       │  send_events  │
                ├───────────────┤       ├───────────────┤
                │ id (PK)       │──────▶│ id (PK)       │
                │ pitch_id (FK) │       │ send_job_id   │
                │ email_acct_id │       │ event_type    │
                │ scheduled_at  │       │ timestamp     │
                │ provider      │       │ metadata      │
                │ status        │       └───────────────┘
                │ attempts      │
                │ last_error    │
                └───────────────┘
```

## Tables

### users
Primary user authentication table.

| Column        | Type         | Nullable | Description              |
|---------------|--------------|----------|--------------------------|
| id            | UUID         | No       | Primary key              |
| email         | VARCHAR(255) | No       | Unique email address     |
| password_hash | VARCHAR(255) | Yes      | Bcrypt hash (null if OAuth) |
| auth_provider | VARCHAR(50)  | No       | 'email' or 'google'      |
| created_at    | TIMESTAMP    | No       | Account creation time    |

### user_profiles
Extended user information for pitch generation.

| Column           | Type         | Nullable | Description              |
|------------------|--------------|----------|--------------------------|
| user_id          | UUID         | No       | PK, references users     |
| name             | VARCHAR(100) | No       | Display name             |
| bio              | TEXT         | No       | User biography           |
| expertise_topics | JSONB        | No       | Array of topics          |
| target_audience  | TEXT         | No       | Ideal listener profile   |
| credentials      | TEXT         | No       | Professional credentials |
| created_at       | TIMESTAMP    | No       | Profile creation time    |
| updated_at       | TIMESTAMP    | No       | Last update time         |

### email_accounts
User-configured email sending accounts.

| Column              | Type         | Nullable | Description                |
|---------------------|--------------|----------|----------------------------|
| id                  | UUID         | No       | Primary key                |
| user_id             | UUID         | No       | References users           |
| provider_type       | VARCHAR(50)  | No       | 'smtp' or 'smartlead'      |
| encrypted_secret_ref| VARCHAR(500) | No       | Secret Manager reference   |
| from_name           | VARCHAR(100) | No       | Sender display name        |
| from_email          | VARCHAR(255) | No       | Sender email address       |
| domain              | VARCHAR(255) | No       | Email domain               |
| health_status       | VARCHAR(50)  | No       | 'healthy', 'warning', 'error' |
| health_details      | JSONB        | Yes      | SPF/DKIM/DMARC results     |
| is_verified         | BOOLEAN      | No       | Email verified flag        |
| created_at          | TIMESTAMP    | No       | Account creation time      |
| updated_at          | TIMESTAMP    | No       | Last update time           |

### podcasts
Podcast catalog from external sources.

| Column                | Type         | Nullable | Description              |
|-----------------------|--------------|----------|--------------------------|
| id                    | UUID         | No       | Primary key              |
| external_source       | VARCHAR(50)  | No       | Data source identifier   |
| external_id           | VARCHAR(255) | No       | Source-specific ID       |
| title                 | VARCHAR(500) | No       | Podcast title            |
| description           | TEXT         | No       | Podcast description      |
| categories            | JSONB        | No       | Array of categories      |
| language              | VARCHAR(10)  | No       | ISO language code        |
| host_name             | VARCHAR(200) | Yes      | Host name                |
| contact_email         | VARCHAR(255) | Yes      | Contact email            |
| website               | VARCHAR(500) | Yes      | Podcast website          |
| audience_size_estimate| INTEGER      | Yes      | Estimated audience       |
| image_url             | VARCHAR(500) | Yes      | Cover image URL          |
| created_at            | TIMESTAMP    | No       | Record creation time     |
| updated_at            | TIMESTAMP    | No       | Last update time         |

**Unique Index**: (external_source, external_id)

### pitches
Generated pitch emails.

| Column            | Type         | Nullable | Description              |
|-------------------|--------------|----------|--------------------------|
| id                | UUID         | No       | Primary key              |
| user_id           | UUID         | No       | References users         |
| podcast_id        | UUID         | No       | References podcasts      |
| generated_subject | VARCHAR(500) | No       | AI-generated subject     |
| generated_body    | TEXT         | No       | AI-generated body        |
| edited_subject    | VARCHAR(500) | Yes      | User-edited subject      |
| edited_body       | TEXT         | Yes      | User-edited body         |
| status            | VARCHAR(50)  | No       | draft/ready/scheduled/sent/failed |
| prompt_version    | VARCHAR(50)  | No       | AI prompt version used   |
| created_at        | TIMESTAMP    | No       | Pitch creation time      |
| updated_at        | TIMESTAMP    | No       | Last update time         |

**Unique Index**: (user_id, podcast_id) - Prevents duplicate pitches

### send_jobs
Email sending queue.

| Column          | Type         | Nullable | Description              |
|-----------------|--------------|----------|--------------------------|
| id              | UUID         | No       | Primary key              |
| pitch_id        | UUID         | No       | References pitches       |
| email_account_id| UUID         | No       | References email_accounts|
| scheduled_at    | TIMESTAMP    | No       | Scheduled send time      |
| provider        | VARCHAR(50)  | No       | Provider used            |
| status          | VARCHAR(50)  | No       | pending/processing/sent/failed/cancelled |
| attempts        | INTEGER      | No       | Number of send attempts  |
| last_error      | TEXT         | Yes      | Last error message       |
| created_at      | TIMESTAMP    | No       | Job creation time        |
| updated_at      | TIMESTAMP    | No       | Last update time         |

### send_events
Email sending event log.

| Column      | Type         | Nullable | Description              |
|-------------|--------------|----------|--------------------------|
| id          | UUID         | No       | Primary key              |
| send_job_id | UUID         | No       | References send_jobs     |
| event_type  | VARCHAR(50)  | No       | queued/processing/sent/opened/bounced/failed |
| timestamp   | TIMESTAMP    | No       | Event time               |
| metadata    | JSONB        | Yes      | Additional event data    |

### responses
Manual response tracking.

| Column      | Type         | Nullable | Description              |
|-------------|--------------|----------|--------------------------|
| id          | UUID         | No       | Primary key              |
| pitch_id    | UUID         | No       | References pitches (unique) |
| status      | VARCHAR(50)  | No       | no_response/interested/declined/booked |
| notes       | TEXT         | Yes      | User notes               |
| created_at  | TIMESTAMP    | No       | Response creation time   |
| updated_at  | TIMESTAMP    | No       | Last update time         |

### user_tiers
Subscription tier and limits.

| Column        | Type         | Nullable | Description              |
|---------------|--------------|----------|--------------------------|
| user_id       | UUID         | No       | PK, references users     |
| tier_name     | VARCHAR(50)  | No       | free/starter/pro/enterprise |
| daily_limit   | INTEGER      | No       | Daily send limit         |
| monthly_limit | INTEGER      | No       | Monthly send limit       |
| created_at    | TIMESTAMP    | No       | Tier assignment time     |
| updated_at    | TIMESTAMP    | No       | Last update time         |

### usage_tracking
Daily usage metrics.

| Column      | Type         | Nullable | Description              |
|-------------|--------------|----------|--------------------------|
| id          | UUID         | No       | Primary key              |
| user_id     | UUID         | No       | References users         |
| date        | TIMESTAMP    | No       | Date (day only)          |
| emails_sent | INTEGER      | No       | Emails sent that day     |

**Unique Index**: (user_id, date)
