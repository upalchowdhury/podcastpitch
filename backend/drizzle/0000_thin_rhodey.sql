CREATE TABLE IF NOT EXISTS "email_accounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"provider_type" varchar(50) NOT NULL,
	"encrypted_secret_ref" varchar(500) NOT NULL,
	"from_name" varchar(100) NOT NULL,
	"from_email" varchar(255) NOT NULL,
	"domain" varchar(255) NOT NULL,
	"health_status" varchar(50) DEFAULT 'unchecked' NOT NULL,
	"health_details" jsonb,
	"is_verified" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "ingestion_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source" varchar(100) NOT NULL,
	"started_at" timestamp DEFAULT now() NOT NULL,
	"finished_at" timestamp,
	"inserted_count" integer DEFAULT 0 NOT NULL,
	"updated_count" integer DEFAULT 0 NOT NULL,
	"failed_count" integer DEFAULT 0 NOT NULL,
	"notes" jsonb
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "pitches" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"podcast_id" uuid NOT NULL,
	"generated_subject" varchar(500) NOT NULL,
	"generated_body" text NOT NULL,
	"edited_subject" varchar(500),
	"edited_body" text,
	"status" varchar(50) DEFAULT 'draft' NOT NULL,
	"prompt_version" varchar(50) NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "podcast_episodes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"podcast_id" uuid NOT NULL,
	"guid" varchar(500) NOT NULL,
	"title" varchar(500) NOT NULL,
	"description" text,
	"url" varchar(1000),
	"published_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "podcast_sources" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"podcast_id" uuid NOT NULL,
	"source" varchar(100) NOT NULL,
	"raw_payload" jsonb,
	"fetched_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "podcasts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"external_source" varchar(50) NOT NULL,
	"external_id" varchar(255) NOT NULL,
	"title" varchar(500) NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"categories" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"language" varchar(10) DEFAULT 'en' NOT NULL,
	"host_name" varchar(200),
	"contact_email" varchar(255),
	"rss_url" varchar(1000),
	"website_url" varchar(500),
	"contact_source" varchar(50) DEFAULT 'dataset' NOT NULL,
	"contact_confidence" integer DEFAULT 0 NOT NULL,
	"feed_last_fetched_at" timestamp,
	"feed_etag" varchar(255),
	"feed_last_modified" varchar(255),
	"feed_status" varchar(50) DEFAULT 'not_started' NOT NULL,
	"contact_enrich_status" varchar(50) DEFAULT 'not_started' NOT NULL,
	"last_error" text,
	"audience_size_estimate" integer,
	"image_url" varchar(500),
	"search_vector" text,
	"publisher" varchar(300),
	"country" varchar(50),
	"genre_ids" jsonb DEFAULT '[]'::jsonb,
	"listen_score" integer,
	"listen_score_global_rank" varchar(50),
	"explicit_content" boolean,
	"has_guest_interviews" boolean,
	"has_sponsors" boolean,
	"first_seen_at" timestamp DEFAULT now() NOT NULL,
	"last_seen_at" timestamp DEFAULT now() NOT NULL,
	"last_enriched_at" timestamp,
	"data_version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "responses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"pitch_id" uuid NOT NULL,
	"status" varchar(50) DEFAULT 'no_response' NOT NULL,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "responses_pitch_id_unique" UNIQUE("pitch_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "send_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"send_job_id" uuid NOT NULL,
	"event_type" varchar(50) NOT NULL,
	"timestamp" timestamp DEFAULT now() NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "send_jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"pitch_id" uuid NOT NULL,
	"email_account_id" uuid NOT NULL,
	"recipient_email" varchar(255),
	"scheduled_at" timestamp NOT NULL,
	"provider" varchar(50) NOT NULL,
	"status" varchar(50) DEFAULT 'pending' NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"last_error" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "target_list_items" (
	"list_id" uuid NOT NULL,
	"podcast_id" uuid NOT NULL,
	"added_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "target_lists" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"name" varchar(100) NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "usage_tracking" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"date" timestamp NOT NULL,
	"emails_sent" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "user_profiles" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"name" varchar(100) NOT NULL,
	"bio" text DEFAULT '' NOT NULL,
	"expertise_topics" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"target_audience" text DEFAULT '' NOT NULL,
	"credentials" text DEFAULT '' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "user_tiers" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"tier_name" varchar(50) DEFAULT 'free' NOT NULL,
	"daily_limit" integer DEFAULT 10 NOT NULL,
	"monthly_limit" integer DEFAULT 50 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" varchar(255) NOT NULL,
	"password_hash" varchar(255),
	"auth_provider" varchar(50) DEFAULT 'email' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "email_accounts_user_id_idx" ON "email_accounts" ("user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ingestion_runs_source_idx" ON "ingestion_runs" ("source");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ingestion_runs_started_at_idx" ON "ingestion_runs" ("started_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "pitches_user_id_idx" ON "pitches" ("user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "pitches_podcast_id_idx" ON "pitches" ("podcast_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "pitches_status_idx" ON "pitches" ("status");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "pitches_user_podcast_idx" ON "pitches" ("user_id","podcast_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "podcast_episodes_podcast_guid_idx" ON "podcast_episodes" ("podcast_id","guid");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "podcast_episodes_podcast_id_idx" ON "podcast_episodes" ("podcast_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "podcast_episodes_published_at_idx" ON "podcast_episodes" ("published_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "podcast_sources_podcast_id_idx" ON "podcast_sources" ("podcast_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "podcast_sources_source_idx" ON "podcast_sources" ("source");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "podcasts_external_idx" ON "podcasts" ("external_source","external_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "podcasts_category_idx" ON "podcasts" ("categories");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "podcasts_language_idx" ON "podcasts" ("language");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "podcasts_feed_status_idx" ON "podcasts" ("feed_status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "podcasts_contact_email_idx" ON "podcasts" ("contact_email");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "podcasts_listen_score_idx" ON "podcasts" ("listen_score");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "send_events_send_job_id_idx" ON "send_events" ("send_job_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "send_events_event_type_idx" ON "send_events" ("event_type");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "send_jobs_pitch_id_idx" ON "send_jobs" ("pitch_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "send_jobs_status_idx" ON "send_jobs" ("status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "send_jobs_scheduled_at_idx" ON "send_jobs" ("scheduled_at");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "target_list_items_pk" ON "target_list_items" ("list_id","podcast_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "target_lists_user_id_idx" ON "target_lists" ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "usage_tracking_user_date_idx" ON "usage_tracking" ("user_id","date");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "users_email_idx" ON "users" ("email");--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "email_accounts" ADD CONSTRAINT "email_accounts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "pitches" ADD CONSTRAINT "pitches_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "pitches" ADD CONSTRAINT "pitches_podcast_id_podcasts_id_fk" FOREIGN KEY ("podcast_id") REFERENCES "podcasts"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "podcast_episodes" ADD CONSTRAINT "podcast_episodes_podcast_id_podcasts_id_fk" FOREIGN KEY ("podcast_id") REFERENCES "podcasts"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "podcast_sources" ADD CONSTRAINT "podcast_sources_podcast_id_podcasts_id_fk" FOREIGN KEY ("podcast_id") REFERENCES "podcasts"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "responses" ADD CONSTRAINT "responses_pitch_id_pitches_id_fk" FOREIGN KEY ("pitch_id") REFERENCES "pitches"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "send_events" ADD CONSTRAINT "send_events_send_job_id_send_jobs_id_fk" FOREIGN KEY ("send_job_id") REFERENCES "send_jobs"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "send_jobs" ADD CONSTRAINT "send_jobs_pitch_id_pitches_id_fk" FOREIGN KEY ("pitch_id") REFERENCES "pitches"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "send_jobs" ADD CONSTRAINT "send_jobs_email_account_id_email_accounts_id_fk" FOREIGN KEY ("email_account_id") REFERENCES "email_accounts"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "target_list_items" ADD CONSTRAINT "target_list_items_list_id_target_lists_id_fk" FOREIGN KEY ("list_id") REFERENCES "target_lists"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "target_list_items" ADD CONSTRAINT "target_list_items_podcast_id_podcasts_id_fk" FOREIGN KEY ("podcast_id") REFERENCES "podcasts"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "target_lists" ADD CONSTRAINT "target_lists_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "usage_tracking" ADD CONSTRAINT "usage_tracking_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "user_profiles" ADD CONSTRAINT "user_profiles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "user_tiers" ADD CONSTRAINT "user_tiers_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
