-- Migration: 0001_topics_taxonomy.sql
-- Description: Create topics taxonomy layer for superior search

-- =============================================================================
-- ENABLE EXTENSIONS
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS unaccent;

-- =============================================================================
-- TOPICS TABLE (Canonical Topics)
-- =============================================================================

CREATE TABLE IF NOT EXISTS topics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    slug VARCHAR(100) NOT NULL UNIQUE,
    display_name VARCHAR(200) NOT NULL,
    parent_id UUID REFERENCES topics(id) ON DELETE SET NULL,
    description TEXT,
    is_generic BOOLEAN NOT NULL DEFAULT false, -- Flag for overly generic topics like "technology"
    created_at TIMESTAMP NOT NULL DEFAULT now(),
    updated_at TIMESTAMP NOT NULL DEFAULT now()
);

-- Index for parent lookups (hierarchy traversal)
CREATE INDEX IF NOT EXISTS idx_topics_parent_id ON topics(parent_id);

-- Trigram index for fuzzy matching on display_name
CREATE INDEX IF NOT EXISTS idx_topics_display_name_trgm ON topics USING gin (display_name gin_trgm_ops);

-- =============================================================================
-- TOPIC ALIASES (Synonyms)
-- =============================================================================

CREATE TABLE IF NOT EXISTS topic_aliases (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    topic_id UUID NOT NULL REFERENCES topics(id) ON DELETE CASCADE,
    alias VARCHAR(200) NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT now(),
    CONSTRAINT topic_aliases_alias_unique UNIQUE(alias)
);

-- Trigram index for fuzzy alias matching
CREATE INDEX IF NOT EXISTS idx_topic_aliases_alias_trgm ON topic_aliases USING gin (alias gin_trgm_ops);

-- Index for topic lookups
CREATE INDEX IF NOT EXISTS idx_topic_aliases_topic_id ON topic_aliases(topic_id);

-- =============================================================================
-- PODCAST TOPICS (Junction with weight)
-- =============================================================================

CREATE TABLE IF NOT EXISTS podcast_topics (
    podcast_id UUID NOT NULL REFERENCES podcasts(id) ON DELETE CASCADE,
    topic_id UUID NOT NULL REFERENCES topics(id) ON DELETE CASCADE,
    weight REAL NOT NULL DEFAULT 1.0 CHECK (weight >= 0.0 AND weight <= 1.0),
    source VARCHAR(50) NOT NULL DEFAULT 'category_map', -- 'category_map', 'episode_inferred', 'nlp', 'manual'
    evidence_count INTEGER NOT NULL DEFAULT 1, -- Number of episodes/sources supporting this topic
    updated_at TIMESTAMP NOT NULL DEFAULT now(),
    PRIMARY KEY (podcast_id, topic_id)
);

-- Index for finding podcasts by topic
CREATE INDEX IF NOT EXISTS idx_podcast_topics_topic_id ON podcast_topics(topic_id);

-- Index for ranking by weight
CREATE INDEX IF NOT EXISTS idx_podcast_topics_weight ON podcast_topics(weight DESC);

-- Composite index for topic search with weight ordering
CREATE INDEX IF NOT EXISTS idx_podcast_topics_topic_weight ON podcast_topics(topic_id, weight DESC);

-- =============================================================================
-- EPISODE TOPICS (Junction with weight - for inference)
-- =============================================================================

CREATE TABLE IF NOT EXISTS episode_topics (
    episode_id UUID NOT NULL REFERENCES podcast_episodes(id) ON DELETE CASCADE,
    topic_id UUID NOT NULL REFERENCES topics(id) ON DELETE CASCADE,
    weight REAL NOT NULL DEFAULT 1.0 CHECK (weight >= 0.0 AND weight <= 1.0),
    source VARCHAR(50) NOT NULL DEFAULT 'title_match', -- 'title_match', 'description_nlp', 'api_tag'
    created_at TIMESTAMP NOT NULL DEFAULT now(),
    PRIMARY KEY (episode_id, topic_id)
);

-- Index for aggregation queries (podcast topics from episodes)
CREATE INDEX IF NOT EXISTS idx_episode_topics_topic_id ON episode_topics(topic_id);

-- =============================================================================
-- LISTEN NOTES GENRE MAPPING
-- =============================================================================

CREATE TABLE IF NOT EXISTS genre_topic_mapping (
    genre_id INTEGER PRIMARY KEY, -- Listen Notes genre ID
    topic_id UUID NOT NULL REFERENCES topics(id) ON DELETE CASCADE,
    created_at TIMESTAMP NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_genre_topic_mapping_topic ON genre_topic_mapping(topic_id);
