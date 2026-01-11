-- Migration: 0002_search_indexes.sql
-- Description: Add proper FTS and trigram indexes for superior podcast search

-- =============================================================================
-- ENSURE EXTENSIONS ARE ENABLED
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS unaccent;

-- =============================================================================
-- ADD COMPUTED TSVECTOR COLUMN (if not exists)
-- =============================================================================

-- Drop the old unused search_vector text column
ALTER TABLE podcasts DROP COLUMN IF EXISTS search_vector;

-- Add computed tsvector column with proper weighting
-- A = highest weight (title), B = medium (publisher/host), C = lowest (description)
ALTER TABLE podcasts ADD COLUMN IF NOT EXISTS search_tsv tsvector
    GENERATED ALWAYS AS (
        setweight(to_tsvector('english', coalesce(title, '')), 'A') ||
        setweight(to_tsvector('english', coalesce(publisher, '')), 'B') ||
        setweight(to_tsvector('english', coalesce(host_name, '')), 'B') ||
        setweight(to_tsvector('english', coalesce(description, '')), 'C')
    ) STORED;

-- =============================================================================
-- FTS INDEX (GIN on tsvector)
-- =============================================================================

CREATE INDEX IF NOT EXISTS idx_podcasts_search_tsv ON podcasts USING gin(search_tsv);

-- =============================================================================
-- TRIGRAM INDEXES (GIN for fuzzy matching)
-- =============================================================================

-- Primary name/title indexes for typo-tolerant search
CREATE INDEX IF NOT EXISTS idx_podcasts_title_trgm ON podcasts USING gin(title gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_podcasts_publisher_trgm ON podcasts USING gin(publisher gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_podcasts_host_name_trgm ON podcasts USING gin(host_name gin_trgm_ops);

-- =============================================================================
-- ADDITIONAL COMPOSITE INDEXES FOR RANKING
-- =============================================================================

-- Composite index for ranked search (topic + listen_score ordering)
CREATE INDEX IF NOT EXISTS idx_podcasts_listen_score_desc ON podcasts(listen_score DESC NULLS LAST);

-- Composite index for recency-aware search
CREATE INDEX IF NOT EXISTS idx_podcasts_latest_episode_desc ON podcasts(latest_episode_pub_date DESC NULLS LAST);

-- =============================================================================
-- INDEX ON TOPIC NAMES FOR FTS
-- =============================================================================

-- Enable FTS on topic display names
ALTER TABLE topics ADD COLUMN IF NOT EXISTS search_tsv tsvector
    GENERATED ALWAYS AS (
        to_tsvector('english', coalesce(display_name, '')) ||
        to_tsvector('english', coalesce(description, ''))
    ) STORED;

CREATE INDEX IF NOT EXISTS idx_topics_search_tsv ON topics USING gin(search_tsv);
