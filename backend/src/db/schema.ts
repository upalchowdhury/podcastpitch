import {
    pgTable,
    uuid,
    varchar,
    text,
    timestamp,
    boolean,
    integer,
    jsonb,
    uniqueIndex,
    index,
    real,
    primaryKey,
} from 'drizzle-orm/pg-core';

// =============================================================================
// USERS & AUTH
// =============================================================================

export const users = pgTable('users', {
    id: uuid('id').primaryKey().defaultRandom(),
    email: varchar('email', { length: 255 }).notNull().unique(),
    passwordHash: varchar('password_hash', { length: 255 }),
    authProvider: varchar('auth_provider', { length: 50 }).notNull().default('email'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
}, (table) => ({
    emailIdx: uniqueIndex('users_email_idx').on(table.email),
}));

// =============================================================================
// USER PROFILES
// =============================================================================

export const userProfiles = pgTable('user_profiles', {
    userId: uuid('user_id').primaryKey().references(() => users.id, { onDelete: 'cascade' }),
    name: varchar('name', { length: 100 }).notNull(),
    bio: text('bio').notNull().default(''),
    expertiseTopics: jsonb('expertise_topics').$type<string[]>().notNull().default([]),
    targetAudience: text('target_audience').notNull().default(''),
    credentials: text('credentials').notNull().default(''),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

// =============================================================================
// EMAIL ACCOUNTS
// =============================================================================

export const emailAccounts = pgTable('email_accounts', {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    providerType: varchar('provider_type', { length: 50 }).notNull(),
    encryptedSecretRef: varchar('encrypted_secret_ref', { length: 500 }).notNull(),
    fromName: varchar('from_name', { length: 100 }).notNull(),
    fromEmail: varchar('from_email', { length: 255 }).notNull(),
    domain: varchar('domain', { length: 255 }).notNull(),
    healthStatus: varchar('health_status', { length: 50 }).notNull().default('unchecked'),
    healthDetails: jsonb('health_details').$type<Record<string, unknown>>(),
    isVerified: boolean('is_verified').notNull().default(false),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (table) => ({
    userIdIdx: index('email_accounts_user_id_idx').on(table.userId),
}));

// =============================================================================
// PODCASTS
// =============================================================================

export const podcasts = pgTable('podcasts', {
    id: uuid('id').primaryKey().defaultRandom(),
    externalSource: varchar('external_source', { length: 50 }).notNull(),
    externalId: varchar('external_id', { length: 255 }).notNull(),
    title: varchar('title', { length: 500 }).notNull(),
    description: text('description').notNull().default(''),
    categories: jsonb('categories').$type<string[]>().notNull().default([]),
    language: varchar('language', { length: 10 }).notNull().default('en'),
    hostName: varchar('host_name', { length: 200 }),
    contactEmail: varchar('contact_email', { length: 255 }),
    // New fields for data acquisition
    rssUrl: varchar('rss_url', { length: 1000 }),
    websiteUrl: varchar('website_url', { length: 500 }),
    contactSource: varchar('contact_source', { length: 50 }).notNull().default('dataset'),
    contactConfidence: integer('contact_confidence').notNull().default(0),
    feedLastFetchedAt: timestamp('feed_last_fetched_at'),
    feedEtag: varchar('feed_etag', { length: 255 }),
    feedLastModified: varchar('feed_last_modified', { length: 255 }),
    feedStatus: varchar('feed_status', { length: 50 }).notNull().default('not_started'),
    contactEnrichStatus: varchar('contact_enrich_status', { length: 50 }).notNull().default('not_started'),
    lastError: text('last_error'),
    // Original fields
    audienceSizeEstimate: integer('audience_size_estimate'),
    imageUrl: varchar('image_url', { length: 500 }),
    // Note: search_tsv is a computed column, not defined in Drizzle schema
    // Listen Notes specific fields
    publisher: varchar('publisher', { length: 300 }),
    country: varchar('country', { length: 50 }),
    genreIds: jsonb('genre_ids').$type<number[]>().default([]),
    listenScore: integer('listen_score'),
    listenScoreGlobalRank: varchar('listen_score_global_rank', { length: 50 }),
    explicitContent: boolean('explicit_content'),
    hasGuestInterviews: boolean('has_guest_interviews'),
    hasSponsors: boolean('has_sponsors'),
    // Activity tracking fields
    latestEpisodePubDate: timestamp('latest_episode_pub_date'),
    totalEpisodes: integer('total_episodes'),
    // Timestamps
    firstSeenAt: timestamp('first_seen_at').notNull().defaultNow(),
    lastSeenAt: timestamp('last_seen_at').notNull().defaultNow(),
    lastEnrichedAt: timestamp('last_enriched_at'),
    dataVersion: integer('data_version').notNull().default(1),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (table) => ({
    externalIdx: uniqueIndex('podcasts_external_idx').on(table.externalSource, table.externalId),
    categoryIdx: index('podcasts_category_idx').on(table.categories),
    languageIdx: index('podcasts_language_idx').on(table.language),
    feedStatusIdx: index('podcasts_feed_status_idx').on(table.feedStatus),
    contactEmailIdx: index('podcasts_contact_email_idx').on(table.contactEmail),
    listenScoreIdx: index('podcasts_listen_score_idx').on(table.listenScore),
    latestEpisodeIdx: index('podcasts_latest_episode_pub_date_idx').on(table.latestEpisodePubDate),
}));

// =============================================================================
// PODCAST SOURCES (Provenance tracking)
// =============================================================================

export const podcastSources = pgTable('podcast_sources', {
    id: uuid('id').primaryKey().defaultRandom(),
    podcastId: uuid('podcast_id').notNull().references(() => podcasts.id, { onDelete: 'cascade' }),
    source: varchar('source', { length: 100 }).notNull(),
    rawPayload: jsonb('raw_payload').$type<Record<string, unknown>>(),
    fetchedAt: timestamp('fetched_at').notNull().defaultNow(),
}, (table) => ({
    podcastIdIdx: index('podcast_sources_podcast_id_idx').on(table.podcastId),
    sourceIdx: index('podcast_sources_source_idx').on(table.source),
}));

// =============================================================================
// TARGET LISTS
// =============================================================================

export const targetLists = pgTable('target_lists', {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    name: varchar('name', { length: 100 }).notNull(),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (table) => ({
    userIdIdx: index('target_lists_user_id_idx').on(table.userId),
}));

export const targetListItems = pgTable('target_list_items', {
    listId: uuid('list_id').notNull().references(() => targetLists.id, { onDelete: 'cascade' }),
    podcastId: uuid('podcast_id').notNull().references(() => podcasts.id, { onDelete: 'cascade' }),
    addedAt: timestamp('added_at').notNull().defaultNow(),
}, (table) => ({
    pk: uniqueIndex('target_list_items_pk').on(table.listId, table.podcastId),
}));

// =============================================================================
// PITCHES
// =============================================================================

export const pitches = pgTable('pitches', {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    podcastId: uuid('podcast_id').notNull().references(() => podcasts.id, { onDelete: 'cascade' }),
    generatedSubject: varchar('generated_subject', { length: 500 }).notNull(),
    generatedBody: text('generated_body').notNull(),
    editedSubject: varchar('edited_subject', { length: 500 }),
    editedBody: text('edited_body'),
    status: varchar('status', { length: 50 }).notNull().default('draft'),
    promptVersion: varchar('prompt_version', { length: 50 }).notNull(),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (table) => ({
    userIdIdx: index('pitches_user_id_idx').on(table.userId),
    podcastIdIdx: index('pitches_podcast_id_idx').on(table.podcastId),
    statusIdx: index('pitches_status_idx').on(table.status),
    userPodcastIdx: uniqueIndex('pitches_user_podcast_idx').on(table.userId, table.podcastId),
}));

// =============================================================================
// SEND JOBS
// =============================================================================

export const sendJobs = pgTable('send_jobs', {
    id: uuid('id').primaryKey().defaultRandom(),
    pitchId: uuid('pitch_id').notNull().references(() => pitches.id, { onDelete: 'cascade' }),
    emailAccountId: uuid('email_account_id').notNull().references(() => emailAccounts.id),
    recipientEmail: varchar('recipient_email', { length: 255 }),
    scheduledAt: timestamp('scheduled_at').notNull(),
    provider: varchar('provider', { length: 50 }).notNull(),
    status: varchar('status', { length: 50 }).notNull().default('pending'),
    attempts: integer('attempts').notNull().default(0),
    lastError: text('last_error'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (table) => ({
    pitchIdIdx: index('send_jobs_pitch_id_idx').on(table.pitchId),
    statusIdx: index('send_jobs_status_idx').on(table.status),
    scheduledAtIdx: index('send_jobs_scheduled_at_idx').on(table.scheduledAt),
}));

// =============================================================================
// SEND EVENTS
// =============================================================================

export const sendEvents = pgTable('send_events', {
    id: uuid('id').primaryKey().defaultRandom(),
    sendJobId: uuid('send_job_id').notNull().references(() => sendJobs.id, { onDelete: 'cascade' }),
    eventType: varchar('event_type', { length: 50 }).notNull(),
    timestamp: timestamp('timestamp').notNull().defaultNow(),
    metadata: jsonb('metadata').$type<Record<string, unknown>>().default({}),
}, (table) => ({
    sendJobIdIdx: index('send_events_send_job_id_idx').on(table.sendJobId),
    eventTypeIdx: index('send_events_event_type_idx').on(table.eventType),
}));

// =============================================================================
// RESPONSES
// =============================================================================

export const responses = pgTable('responses', {
    id: uuid('id').primaryKey().defaultRandom(),
    pitchId: uuid('pitch_id').notNull().unique().references(() => pitches.id, { onDelete: 'cascade' }),
    status: varchar('status', { length: 50 }).notNull().default('no_response'),
    notes: text('notes'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

// =============================================================================
// USER TIERS / BILLING
// =============================================================================

export const userTiers = pgTable('user_tiers', {
    userId: uuid('user_id').primaryKey().references(() => users.id, { onDelete: 'cascade' }),
    tierName: varchar('tier_name', { length: 50 }).notNull().default('free'),
    dailyLimit: integer('daily_limit').notNull().default(10),
    monthlyLimit: integer('monthly_limit').notNull().default(50),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

// =============================================================================
// USAGE TRACKING
// =============================================================================

export const usageTracking = pgTable('usage_tracking', {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    date: timestamp('date').notNull(),
    emailsSent: integer('emails_sent').notNull().default(0),
}, (table) => ({
    userDateIdx: uniqueIndex('usage_tracking_user_date_idx').on(table.userId, table.date),
}));

// =============================================================================
// PODCAST EPISODES
// =============================================================================

export const podcastEpisodes = pgTable('podcast_episodes', {
    id: uuid('id').primaryKey().defaultRandom(),
    podcastId: uuid('podcast_id').notNull().references(() => podcasts.id, { onDelete: 'cascade' }),
    guid: varchar('guid', { length: 500 }).notNull(),
    title: varchar('title', { length: 500 }).notNull(),
    description: text('description'),
    url: varchar('url', { length: 1000 }),
    publishedAt: timestamp('published_at'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
}, (table) => ({
    podcastGuidIdx: uniqueIndex('podcast_episodes_podcast_guid_idx').on(table.podcastId, table.guid),
    podcastIdIdx: index('podcast_episodes_podcast_id_idx').on(table.podcastId),
    publishedAtIdx: index('podcast_episodes_published_at_idx').on(table.publishedAt),
}));

// =============================================================================
// INGESTION RUNS
// =============================================================================

export const ingestionRuns = pgTable('ingestion_runs', {
    id: uuid('id').primaryKey().defaultRandom(),
    source: varchar('source', { length: 100 }).notNull(),
    startedAt: timestamp('started_at').notNull().defaultNow(),
    finishedAt: timestamp('finished_at'),
    insertedCount: integer('inserted_count').notNull().default(0),
    updatedCount: integer('updated_count').notNull().default(0),
    failedCount: integer('failed_count').notNull().default(0),
    notes: jsonb('notes').$type<Record<string, unknown>>(),
}, (table) => ({
    sourceIdx: index('ingestion_runs_source_idx').on(table.source),
    startedAtIdx: index('ingestion_runs_started_at_idx').on(table.startedAt),
}));

// =============================================================================
// TOPICS (Canonical Topics Taxonomy)
// =============================================================================

export const topics = pgTable('topics', {
    id: uuid('id').primaryKey().defaultRandom(),
    slug: varchar('slug', { length: 100 }).notNull().unique(),
    displayName: varchar('display_name', { length: 200 }).notNull(),
    parentId: uuid('parent_id').references((): any => topics.id, { onDelete: 'set null' }),
    description: text('description'),
    isGeneric: boolean('is_generic').notNull().default(false),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (table) => ({
    parentIdIdx: index('idx_topics_parent_id').on(table.parentId),
}));

// =============================================================================
// TOPIC ALIASES (Synonyms)
// =============================================================================

export const topicAliases = pgTable('topic_aliases', {
    id: uuid('id').primaryKey().defaultRandom(),
    topicId: uuid('topic_id').notNull().references(() => topics.id, { onDelete: 'cascade' }),
    alias: varchar('alias', { length: 200 }).notNull().unique(),
    createdAt: timestamp('created_at').notNull().defaultNow(),
}, (table) => ({
    topicIdIdx: index('idx_topic_aliases_topic_id').on(table.topicId),
}));

// =============================================================================
// PODCAST TOPICS (Junction with weight)
// =============================================================================

export const podcastTopics = pgTable('podcast_topics', {
    podcastId: uuid('podcast_id').notNull().references(() => podcasts.id, { onDelete: 'cascade' }),
    topicId: uuid('topic_id').notNull().references(() => topics.id, { onDelete: 'cascade' }),
    weight: real('weight').notNull().default(1.0),
    source: varchar('source', { length: 50 }).notNull().default('category_map'),
    evidenceCount: integer('evidence_count').notNull().default(1),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (table) => ({
    pk: primaryKey({ columns: [table.podcastId, table.topicId] }),
    topicIdIdx: index('idx_podcast_topics_topic_id').on(table.topicId),
    weightIdx: index('idx_podcast_topics_weight').on(table.weight),
}));

// =============================================================================
// EPISODE TOPICS (Junction with weight - for inference)
// =============================================================================

export const episodeTopics = pgTable('episode_topics', {
    episodeId: uuid('episode_id').notNull().references(() => podcastEpisodes.id, { onDelete: 'cascade' }),
    topicId: uuid('topic_id').notNull().references(() => topics.id, { onDelete: 'cascade' }),
    weight: real('weight').notNull().default(1.0),
    source: varchar('source', { length: 50 }).notNull().default('title_match'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
}, (table) => ({
    pk: primaryKey({ columns: [table.episodeId, table.topicId] }),
    topicIdIdx: index('idx_episode_topics_topic_id').on(table.topicId),
}));

// =============================================================================
// GENRE TOPIC MAPPING (Listen Notes genre_id → topic mapping)
// =============================================================================

export const genreTopicMapping = pgTable('genre_topic_mapping', {
    genreId: integer('genre_id').primaryKey(),
    topicId: uuid('topic_id').notNull().references(() => topics.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at').notNull().defaultNow(),
}, (table) => ({
    topicIdIdx: index('idx_genre_topic_mapping_topic').on(table.topicId),
}));
