# Delta: Hybrid Search-Triggered Ingestion (Listen Notes PRO)

This document is **ONLY** the delta for implementing **Search → Fetch → Store → Render** using **Listen Notes PRO**.  
Goal: ship MVP fast while building your own database over time (no “proxy-only” approach).

---

## 0) Key Principle

**Always query your local Postgres first.**  
If results are insufficient, **call Listen Notes `/search`**, then **upsert** returned podcasts into your DB, then **return combined results**.

This gives:
- fast UX over time (cache warms naturally)
- dedupe & pitch tracking
- scalable path to “mostly-local” results without preloading the world

---

## 1) Listen Notes Endpoints You Will Use

### A) Discover podcasts (search)
- **GET** `/search?type=podcast&q=...&offset=...&page_size=...&language=...&region=...&genre_ids=...`

Use this when local DB results are below your threshold.

### B) Enrich podcast detail + episodes (on demand)
- **GET** `/podcasts/{id}?sort=recent_first&next_episode_pub_date=...`

Use this only when:
- user clicks into a podcast
- user adds podcast to a target list
- user generates a pitch (needs latest context)

### C) Cacheable dictionaries
- **GET** `/genres`
- **GET** `/languages`
- **GET** `/regions`

Fetch once at startup or on a scheduled refresh (weekly/monthly).

---

## 2) Minimal DB Schema Changes (MVP)

Add/ensure these fields exist on `podcasts`:

- `external_source` TEXT NOT NULL DEFAULT 'listen_notes'
- `external_id` TEXT NOT NULL UNIQUE  -- Listen Notes podcast id
- `title` TEXT
- `description` TEXT
- `publisher` TEXT
- `website_url` TEXT
- `rss_url` TEXT                      -- PRO plan: available in API
- `contact_email` TEXT                -- PRO plan: available in API
- `language` TEXT
- `country` TEXT
- `genre_ids` INT[] or JSONB
- `listen_score` INT NULL
- `listen_score_global_rank` TEXT NULL
- `explicit_content` BOOLEAN NULL
- `has_guest_interviews` BOOLEAN NULL
- `has_sponsors` BOOLEAN NULL
- `first_seen_at` TIMESTAMPTZ NOT NULL DEFAULT now()
- `last_seen_at` TIMESTAMPTZ NOT NULL DEFAULT now()
- `last_enriched_at` TIMESTAMPTZ NULL
- `data_version` INT NOT NULL DEFAULT 1

Add a table to track provenance and debugging (very helpful):
- `podcast_sources(podcast_id, source, raw_payload_jsonb, fetched_at)`

---

## 3) Search API: Request/Response Mapping

Listen Notes `/search` response (when `type=podcast`) returns items like `PodcastSearchResult` with fields including:
- `id`
- `title_original`
- `description_original`
- `publisher_original`
- `website`
- `email` (PRO)
- `rss` (PRO)
- `language`, `country`
- `genre_ids`
- `listen_score`, `listen_score_global_rank`
- `explicit_content`
- `has_guest_interviews`, `has_sponsors`

Map to your schema as:

- `external_id`      ← `id`
- `title`            ← `title_original`
- `description`      ← `description_original`
- `publisher`        ← `publisher_original`
- `website_url`      ← `website`
- `contact_email`    ← `email`
- `rss_url`          ← `rss`
- `language`         ← `language`
- `country`          ← `country`
- `genre_ids`        ← `genre_ids`
- `listen_score`     ← `listen_score`
- `listen_score_global_rank` ← `listen_score_global_rank`
- `explicit_content` ← `explicit_content`
- `has_guest_interviews` ← `has_guest_interviews`
- `has_sponsors`     ← `has_sponsors`
- `last_seen_at`     ← now()

---

## 4) The MVP Search Flow (Exact Logic)

### 4.1 API contract (your backend)
Implement:
- `GET /api/search/podcasts?q=...&filters...&page=...`

Return:
- list of podcasts (from local + LN)
- `source_breakdown` (counts local vs LN)
- `next` (local page token OR LN next_offset info)

### 4.2 Decision thresholds (recommended defaults)
- `LOCAL_MIN_RESULTS = 20` (per query)
- `LN_PAGE_SIZE = 10` (Listen Notes allowed 1..10)
- `LN_MAX_PAGES_PER_QUERY = 3` for MVP (avoid quota surprises)
- `CACHE_TTL_SEARCH = 30 days` for podcasts (they don’t change often)

### 4.3 Algorithm (pseudocode)

**Inputs:** query `q`, filters (language, region, genre_ids, safe_mode), page cursor.

1. **Normalize query**
   - trim whitespace
   - lowercase for local index
   - store `query_hash` for caching & analytics

2. **Search local DB first**
   - use Postgres FTS on `title`, `description`, `publisher`
   - apply filters (language, country, genre overlap)
   - order by:
     - text rank (ts_rank)
     - then `listen_score` desc
     - then `last_seen_at` desc
   - fetch `LOCAL_MIN_RESULTS` (or page size requested by UI)

3. **If local results >= LOCAL_MIN_RESULTS**
   - return local results only

4. **Else call Listen Notes `/search`**
   - `type=podcast`
   - `q=q`
   - include filters:
     - `language=English` (or other)
     - `region=us` (if applicable)
     - `genre_ids=...` (if applicable)
     - `safe_mode=1` if you want to exclude explicit
   - `offset` based on cursor (start 0)
   - `page_size=10`

5. **Upsert returned podcasts**
   - For each podcast:
     - `INSERT ... ON CONFLICT (external_id) DO UPDATE ...`
     - Update fields if non-null
     - Always set `last_seen_at=now()`
     - Preserve your own enrichment fields (don’t overwrite with null)
   - Save `raw_payload_jsonb` into `podcast_sources` for debugging

6. **Merge + dedupe for response**
   - Combine local results + newly upserted LN results
   - Deduplicate by `external_id`
   - Return top N

7. **Return pagination cursor**
   - For LN: use `next_offset` from response
   - For local: use page number or keyset pagination

---

## 5) Upsert Rules (Important)

### 5.1 Don’t overwrite good data with nulls
When `email` or `rss` is missing from LN payload, do **not** clear existing values.

Recommended rule:
- Only update a column if incoming value is non-null AND non-empty.

### 5.2 Preserve your internal fields
Never overwrite:
- `internal_tags`
- `pitch_status`
- `last_contacted_at`
- `user_notes`
- `contact_verified`
- `contact_confidence`

### 5.3 Track provenance
Set:
- `external_source = 'listen_notes'`
- `data_version += 1` when a meaningful change occurs (optional)

---

## 6) Enrichment on Demand (Podcast Detail)

When user opens a podcast detail page:

1. Call local DB:
   - if `last_enriched_at` < 7 days ago: return local
2. Else call:
   - **GET** `/podcasts/{id}?sort=recent_first`
3. Upsert podcast fields again (same null-safe rules)
4. Store latest episodes:
   - store the most recent 10 episodes in `episodes` table
   - each episode should have:
     - `external_id`, `podcast_external_id`, `title`, `description`, `pub_date_ms`, `audio_url`, `link`, `explicit_content`
5. Set `last_enriched_at=now()`

---

## 7) Quota / Rate Limit Safety (MVP)

### 7.1 Request shaping
- Hard cap:
  - max 3 LN pages per user search
  - max 1 enrichment call per podcast per 7 days
- Add per-user rate limiting:
  - e.g., 30 searches / hour / user

### 7.2 Caching
- Cache LN `/search` results by `(q, filters, offset)` for 10–60 minutes
- Cache `/genres`, `/languages`, `/regions` for 7–30 days

### 7.3 Observability
Log for every LN call:
- endpoint, q, filters, offset, latency, status
- X-ListenAPI-Usage headers (track spend)
- response count

---

## 8) MVP Acceptance Criteria (for “is it working?”)

### Functional
- Searching returns results even when DB is empty (via LN)
- After first search, repeating the same search returns mostly from local DB
- Podcasts can be added to “targets” and not duplicated
- Producer emails appear when available (PRO plan)

### Data quality
- `external_id` uniqueness prevents duplicates
- `contact_email` is stored and not lost across refreshes

### Operational
- LN API calls per search are bounded
- Quota usage is logged and visible in admin dashboard

---

## 9) What to Build Later (NOT MVP)

- full background crawl across all genres
- deep website scraping
- transcript ingestion
- semantic vector search over episodes

Ship the hybrid search ingestion first; it unlocks everything else.
