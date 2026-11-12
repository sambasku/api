-- Jinye: status singkat (teks / voice / foto). Post-moderation.
CREATE TABLE `jinye` (
  `id` text PRIMARY KEY NOT NULL,
  `user_id` text NOT NULL,
  `body` text DEFAULT '' NOT NULL,
  `body_original` text,
  `images` text DEFAULT '[]' NOT NULL,
  `audio_url` text,
  `audio_mime_type` text,
  `audio_file_size` integer,
  `audio_duration_ms` integer,
  `audio_provider` text,
  `audio_provider_file_id` text,
  `audio_sha` text,
  `repost_of_id` text,
  `quote_body` text,
  `status` text DEFAULT 'published' NOT NULL,
  `taken_down_by` text,
  `taken_down_at` integer,
  `published_comment_count` integer DEFAULT 0 NOT NULL,
  `repost_count` integer DEFAULT 0 NOT NULL,
  `created_at` integer NOT NULL,
  `updated_at` integer,
  FOREIGN KEY (`user_id`) REFERENCES `users`(`id`),
  FOREIGN KEY (`taken_down_by`) REFERENCES `users`(`id`)
);
--> statement-breakpoint
CREATE INDEX `jinye_status_id_idx` ON `jinye` (`status`,`id`);
--> statement-breakpoint
CREATE INDEX `jinye_user_created_idx` ON `jinye` (`user_id`,`created_at`,`id`);
--> statement-breakpoint
CREATE INDEX `jinye_status_created_idx` ON `jinye` (`status`,`created_at`,`id`);
--> statement-breakpoint
CREATE TABLE `jinye_revisions` (
  `id` text PRIMARY KEY NOT NULL,
  `jinye_id` text NOT NULL,
  `editor_id` text NOT NULL,
  `body` text NOT NULL,
  `created_at` integer NOT NULL,
  FOREIGN KEY (`jinye_id`) REFERENCES `jinye`(`id`) ON UPDATE no action ON DELETE cascade,
  FOREIGN KEY (`editor_id`) REFERENCES `users`(`id`)
);
--> statement-breakpoint
CREATE INDEX `jinye_revisions_jinye_id_idx` ON `jinye_revisions` (`jinye_id`,`created_at`);
