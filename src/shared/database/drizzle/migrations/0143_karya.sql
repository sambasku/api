-- Migration 0143: katalog Karya (Musik + Film) - PRD docs/backlogs/KARYA.md
-- Karya-first: credits name_text wajib; kreator_id nullable (klaim G4).

CREATE TABLE `kreators` (
  `id` text PRIMARY KEY NOT NULL,
  `slug` text NOT NULL,
  `display_name` text NOT NULL,
  `kind` text DEFAULT 'person' NOT NULL,
  `bio` text,
  `origin_region` text,
  `links_json` text DEFAULT '[]' NOT NULL,
  `created_at` integer NOT NULL,
  `updated_at` integer,
  `deleted_at` integer
);
--> statement-breakpoint
CREATE UNIQUE INDEX `kreators_slug_uidx` ON `kreators` (`slug`);
--> statement-breakpoint
CREATE INDEX `kreators_display_name_idx` ON `kreators` (`display_name`);
--> statement-breakpoint
CREATE INDEX `kreators_kind_idx` ON `kreators` (`kind`);
--> statement-breakpoint
CREATE TABLE `karyas` (
  `id` text PRIMARY KEY NOT NULL,
  `slug` text NOT NULL,
  `title` text NOT NULL,
  `kind` text NOT NULL,
  `year` integer NOT NULL,
  `language` text,
  `description` text,
  `cover_url` text,
  `cover_attribution_json` text,
  `sambas_connections_json` text DEFAULT '[]' NOT NULL,
  `access_links_json` text DEFAULT '[]' NOT NULL,
  `sources_json` text DEFAULT '[]' NOT NULL,
  `related_json` text DEFAULT '[]' NOT NULL,
  `music_release_type` text,
  `music_duration_ms` integer,
  `music_is_cover` integer DEFAULT false NOT NULL,
  `film_type` text,
  `film_runtime_min` integer,
  `publish_status` text DEFAULT 'draft' NOT NULL,
  `restricted_reason` text,
  `restricted_at` integer,
  `author_id` text,
  `published_at` integer,
  `created_at` integer NOT NULL,
  `updated_at` integer,
  `deleted_at` integer
);
--> statement-breakpoint
CREATE UNIQUE INDEX `karyas_slug_uidx` ON `karyas` (`slug`);
--> statement-breakpoint
CREATE INDEX `karyas_publish_status_idx` ON `karyas` (`publish_status`);
--> statement-breakpoint
CREATE INDEX `karyas_status_kind_idx` ON `karyas` (`publish_status`, `kind`);
--> statement-breakpoint
CREATE INDEX `karyas_status_year_idx` ON `karyas` (`publish_status`, `year`);
--> statement-breakpoint
CREATE INDEX `karyas_title_idx` ON `karyas` (`title`);
--> statement-breakpoint
CREATE INDEX `karyas_status_updated_at_idx` ON `karyas` (`publish_status`, `updated_at`);
--> statement-breakpoint
CREATE TABLE `karya_credits` (
  `id` text PRIMARY KEY NOT NULL,
  `karya_id` text NOT NULL,
  `role` text NOT NULL,
  `name_text` text NOT NULL,
  `kreator_id` text,
  `sort_order` integer DEFAULT 0 NOT NULL,
  `created_at` integer NOT NULL,
  `updated_at` integer,
  FOREIGN KEY (`karya_id`) REFERENCES `karyas`(`id`) ON UPDATE no action ON DELETE cascade,
  FOREIGN KEY (`kreator_id`) REFERENCES `kreators`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `karya_credits_karya_sort_idx` ON `karya_credits` (`karya_id`, `sort_order`);
--> statement-breakpoint
CREATE INDEX `karya_credits_kreator_idx` ON `karya_credits` (`kreator_id`);
--> statement-breakpoint
CREATE INDEX `karya_credits_role_idx` ON `karya_credits` (`karya_id`, `role`);
--> statement-breakpoint
CREATE TABLE `karya_excerpts` (
  `id` text PRIMARY KEY NOT NULL,
  `karya_id` text NOT NULL,
  `kind` text NOT NULL,
  `text` text NOT NULL,
  `language` text,
  `start_label` text,
  `end_label` text,
  `rights_status` text NOT NULL,
  `rights_note` text,
  `source_url` text,
  `publish_status` text DEFAULT 'draft' NOT NULL,
  `author_id` text,
  `published_at` integer,
  `created_at` integer NOT NULL,
  `updated_at` integer,
  `deleted_at` integer,
  FOREIGN KEY (`karya_id`) REFERENCES `karyas`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `karya_excerpts_karya_status_idx` ON `karya_excerpts` (`karya_id`, `publish_status`);
--> statement-breakpoint
CREATE INDEX `karya_excerpts_kind_status_idx` ON `karya_excerpts` (`kind`, `publish_status`);
--> statement-breakpoint
CREATE TABLE `karya_contributions` (
  `id` text PRIMARY KEY NOT NULL,
  `kind` text NOT NULL,
  `user_id` text NOT NULL,
  `karya_id` text,
  `locked_fields` text DEFAULT '' NOT NULL,
  `payload_json` text NOT NULL,
  `base_updated_at` integer,
  `status` text DEFAULT 'pending' NOT NULL,
  `result_karya_id` text,
  `result_excerpt_id` text,
  `revision_note` text,
  `reject_reason_code` text,
  `reject_reason_text` text,
  `created_at` integer NOT NULL,
  `updated_at` integer,
  `reviewed_at` integer
);
--> statement-breakpoint
CREATE INDEX `karya_contributions_user_status_idx` ON `karya_contributions` (`user_id`, `status`);
--> statement-breakpoint
CREATE INDEX `karya_contributions_status_created_idx` ON `karya_contributions` (`status`, `created_at`);
--> statement-breakpoint
CREATE INDEX `karya_contributions_karya_idx` ON `karya_contributions` (`karya_id`, `status`);
--> statement-breakpoint
CREATE INDEX `karya_contributions_kind_status_idx` ON `karya_contributions` (`kind`, `status`);
