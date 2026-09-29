CREATE TABLE `ugc_anon_abuse_events` (
	`id` text PRIMARY KEY NOT NULL,
	`subject_kind` text NOT NULL,
	`subject_key` text NOT NULL,
	`signal` text NOT NULL,
	`weight` integer DEFAULT 0 NOT NULL,
	`entity_type` text,
	`entity_id` text,
	`meta` text,
	`created_at` integer NOT NULL
);--> statement-breakpoint
CREATE INDEX `ugc_anon_abuse_events_subject_created_idx` ON `ugc_anon_abuse_events` (`subject_kind`,`subject_key`,`created_at`);--> statement-breakpoint
CREATE TABLE `ugc_anon_mutes` (
	`subject_kind` text NOT NULL,
	`subject_key` text NOT NULL,
	`muted_until` integer NOT NULL,
	`updated_at` integer,
	PRIMARY KEY(`subject_kind`, `subject_key`)
);
