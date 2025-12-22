# Podcast Pitch Platform — Podcast Data Acquisition Plan (MVP → Prod)

> **Assumption from user:** Your dataset/API provides **both** (a) **RSS URLs** for most podcasts and (b) **contact emails** for many podcasts.
>
> **Goal:** Implement the fastest + safest pipeline:
> 1) Ingest licensed dataset/API (populate `podcasts` with RSS + contact)
> 2) Refresh/enrich via RSS ingestion (episodes + website freshness)
> 3) Light website enrichment ONLY when contact email missing/low-confidence (bounded crawl)
>
> **Platform:** GCP — Cloud Run, Cloud SQL Postgres, Cloud Tasks, Cloud Scheduler, Secret Manager

---

## 1) What data we must store (PRD-driven)

### 1.1 Podcast discovery (search/filter + details)
**Required fields**
- `external_source`, `external_id` (stable identity)
- `title`, `description`
- `categories[]`, `language`
- `website_url`
- `rss_url`

**Nice-to-have** (helps ranking + UX)
- `host_name`
- `audience_size_estimate`
- `country/region`
- `artwork_url`

### 1.2 Pitch personalization
**Required**
- `host_name` (if available)
- recent episodes (titles; short summaries optional)

### 1.3 Outreach
**Required**
- `contact_email` (best)
- store provenance + confidence:
  - `contact_source` enum: `dataset|rss|website`
  - `contact_confidence` int: 0–100

### 1.4 Dedupe
- enforce `UNIQUE(user_id, podcast_id)` for outreach/target list items
- enforce `UNIQUE(external_source, external_id)` for podcasts

---

## 2) Database changes (minimal, production-extendable)

### 2.1 `podcasts` additions
Add columns:
- `rss_url TEXT NULL`
- `website_url TEXT NULL`
- `contact_email TEXT NULL`
- `contact_source TEXT NOT NULL DEFAULT 'dataset'`
- `contact_confidence INT NOT NULL DEFAULT 0`
- `feed_last_fetched_at TIMESTAMP NULL`
- `feed_etag TEXT NULL`
- `feed_last_modified TEXT NULL`
- `feed_status TEXT NOT NULL DEFAULT 'not_started'`  
  values: `not_started|queued|ok|not_modified|failed|blocked`
- `contact_enrich_status TEXT NOT NULL DEFAULT 'not_started'`  
  values: `not_started|queued|found|not_found|failed|blocked`
- `last_error TEXT NULL`

Indexes:
- FTS index for `title/description` (Postgres)
- B-tree indexes:
  - `(language)`
  - `(feed_last_fetched_at)`
  - `(contact_email)`
- If `categories` is array/json: add a GIN index

### 2.2 `podcast_episodes` (recommended)
Create table:
- `podcast_episodes(id UUID PK, podcast_id UUID FK, guid TEXT, title TEXT, published_at TIMESTAMP, description TEXT, url TEXT)`
- Unique: `(podcast_id, guid)`

### 2.3 `ingestion_runs`
- `id UUID PK`
- `source TEXT`
- `started_at`, `finished_at`
- `inserted_count`, `updated_count`, `failed_count`
- `notes JSONB`

---

## 3) GCP resources to create

### 3.1 Cloud Run services
- `api` (main backend)
- `worker` (Cloud Tasks handlers)

### 3.2 Cloud Tasks queues
Create queues:
1) `rss-fetch-queue`
2) `contact-enrich-queue`
3) `dataset-upsert-queue` (optional for very large imports)

Initial safe settings (tune later):
- `maxDispatchesPerSecond`: 5
- `maxConcurrentDispatches`: 50
- retry: exponential backoff, max attempts 5–8

### 3.3 Cloud Scheduler
Cron triggers:
- Nightly RSS refresh enqueue (daily at 2:00am)
- Daily contact enrichment enqueue (daily at 3:00am)
- Weekly dataset refresh (if you receive weekly export)

### 3.4 Secret Manager
Store:
- dataset/API keys
- optional proxy credentials

---

## 4) Step 1 — Licensed dataset/API ingestion (primary source)

### 4.1 Input contract (what importer expects)
Dataset/API records should provide most of:
- `external_id`
- `title`, `description`
- `categories`, `language`
- `rss_url`
- `website_url`
- `contact_email` (if available)
- `host_name` (if available)

### 4.2 Import method options
**Option A: File-based (CSV/JSON/Parquet)**
- upload raw dump to Cloud Storage: `gs://podcast-raw/exports/...`
- run Cloud Run Job: `dataset-import`

**Option B: API-based sync**
- Cloud Run Job pulls pages from API
- optionally stores pulled raw JSON to Cloud Storage for audit/debug

### 4.3 Upsert rules (idempotent)
For each record:
- Identify by `(external_source, external_id)`
- Upsert into `podcasts`
- Only overwrite fields from dataset when:
  - destination is NULL, OR
  - dataset is newer and non-empty

**Contact email handling**
- If dataset provides `contact_email`:
  - set `contact_email`
  - set `contact_source='dataset'`
  - set `contact_confidence=85` (baseline)

### 4.4 Write an `ingestion_runs` report
Record counts + failures. Import must be rerunnable.

---

## 5) Step 2 — RSS ingestion (freshness + episode context)

### 5.1 Scheduling logic (enqueue)
A scheduler-triggered API endpoint enqueues RSS fetch tasks:
- select podcasts where:
  - `rss_url IS NOT NULL`
  - and (`feed_last_fetched_at IS NULL` OR `feed_last_fetched_at < now() - interval '24 hours'`)
- enqueue one task per `podcast_id` into `rss-fetch-queue`

### 5.2 Worker handler: RSS fetch
For each `podcast_id`:
1) Load `rss_url`, `feed_etag`, `feed_last_modified`
2) HTTP GET with conditional headers:
   - `If-None-Match` and `If-Modified-Since`
3) On `304 Not Modified`:
   - update `feed_last_fetched_at=now()`
   - set `feed_status='not_modified'`
4) On `200 OK`:
   - parse feed
   - update podcast fields carefully:
     - `website_url` only if missing
     - `host_name` only if missing
     - optionally refresh `description` if dataset empty
   - upsert last N episodes (10–20) into `podcast_episodes`
   - capture ETag/Last-Modified headers
   - update `feed_last_fetched_at=now()`
   - set `feed_status='ok'`
5) On transient errors (timeouts, 5xx):
   - allow Cloud Tasks retries
6) On consistent blocks (403, 429):
   - set `feed_status='blocked'` and stop aggressive retries

### 5.3 Rate limiting
- Let Cloud Tasks control dispatch rates
- Add per-worker concurrency cap (e.g., 10–20) to avoid spikes

---

## 6) Step 3 — Light website enrichment for contact email (bounded)

### 6.1 When to run
Only enqueue contact enrichment if:
- `contact_email IS NULL` OR `contact_confidence < 70`
AND
- `website_url IS NOT NULL`

### 6.2 Bounded crawl policy (MVP)
- Max pages fetched per podcast: **5**
- Same-domain only
- No headless browser (no Playwright) for MVP
- Follow only likely pages:
  - homepage
  - links containing: `contact`, `about`, `advertise`, `sponsor`, `team`
- Stop immediately when a high-confidence email is found

### 6.3 Worker handler: contact enrichment
For each `podcast_id`:
1) Fetch homepage HTML
2) Extract emails:
   - `mailto:` links (highest confidence)
   - regex matches (lower confidence)
   - simple obfuscation patterns: `name [at] domain [dot] com`
3) If found:
   - save `contact_email`
   - `contact_source='website'`
   - `contact_confidence=90` if mailto else 70–80
   - `contact_enrich_status='found'`
4) If not found:
   - fetch up to 4 internal candidate pages and repeat
   - end with `contact_enrich_status='not_found'`
5) If blocked:
   - `contact_enrich_status='blocked'`

### 6.4 Anti-abuse/politeness
- Use a clear User-Agent: `PodcastPitchBot/1.0 (contact: support@yourdomain)`
- Respect timeouts
- Avoid repeated attempts; store last attempted timestamp and cool down

---

## 7) Search readiness (MVP)

### 7.1 Postgres FTS
- Maintain a `tsvector` over `title + description`
- Provide filters:
  - category
  - language
  - audience size (if available)

### 7.2 Ranking signals (simple)
- text relevance
- recency (`feed_last_fetched_at`, `last_published_at` if captured)
- audience estimate (optional)

---

## 8) Operational guardrails

### 8.1 Idempotency
- Dataset upsert: safe to rerun
- RSS ingestion: unique on `(podcast_id, guid)` for episodes
- Contact enrichment: safe to rerun; do not downgrade confidence unless email removed/invalid

### 8.2 Observability
Log fields (structured):
- `podcast_id`, `rss_url`, `website_url`, `task_type`, `status`, `duration_ms`, `error_code`

Metrics:
- RSS success rate
- 304 rate (cache efficiency)
- Contact found rate
- Blocked rate

Alerts:
- spike in blocked/429
- queue backlog growth

---

## 9) Acceptance criteria (MVP)

### Dataset ingestion
- Imports ≥ 50k podcasts successfully
- Re-run does not duplicate records
- RSS URL coverage is measurable (report %)
- Contact email coverage is measurable (report %)

### RSS ingestion
- Nightly refresh completes
- Uses ETag/Last-Modified (304s observed)
- Episodes stored for at least 10 recent items

### Contact enrichment
- Runs only when email missing/low confidence
- Bounded to ≤ 5 pages per podcast
- Stores confidence + source + status

---

## 10) Production extensions (do NOT implement now)
- Upgrade search: OpenSearch / Vertex AI Search
- Export events/analytics: BigQuery
- Add Playwright for hard sites (opt-in)
- Add per-domain throttling table for crawl scheduling

---

## 11) Implementation order (strict)
1) DB migrations + indexes
2) Dataset import job + `ingestion_runs`
3) RSS enqueue endpoint + RSS worker task
4) Episodes table + upsert logic
5) Contact enrichment enqueue endpoint + contact worker task
6) API search endpoints for UI
7) Monitoring + alerting

---

## 12) Configuration decisions (no code changes)
- Dataset source name (`external_source`)
- Dataset refresh cadence (weekly/monthly)
- RSS refresh cadence (daily recommended)
- Contact enrichment cadence (daily recommended)
