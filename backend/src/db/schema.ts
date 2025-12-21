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
    website: varchar('website', { length: 500 }),
    audienceSizeEstimate: integer('audience_size_estimate'),
    imageUrl: varchar('image_url', { length: 500 }),
    searchVector: text('search_vector'), // For full-text search
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (table) => ({
    externalIdx: uniqueIndex('podcasts_external_idx').on(table.externalSource, table.externalId),
    categoryIdx: index('podcasts_category_idx').on(table.categories),
    languageIdx: index('podcasts_language_idx').on(table.language),
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
