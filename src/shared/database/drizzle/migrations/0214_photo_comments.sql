-- Migration 0214: komentar foto UGC (#387). Satu tabel generik untuk foto
-- lemma, wisata, usaha, kuliner, dan acara.
CREATE TABLE `photo_comments` (
  `id` text PRIMARY KEY NOT NULL,
  `photo_kind` text NOT NULL,
  `photo_ref` text NOT NULL,
  `host_id` text NOT NULL,
  `parent_id` text,
  `user_id` text NOT NULL REFERENCES `users`(`id`),
  `body` text NOT NULL,
  `body_original` text,
  `status` text NOT NULL DEFAULT 'published',
  `reviewed_by` text REFERENCES `users`(`id`),
  `reviewed_at` integer,
  `created_at` integer NOT NULL,
  `updated_at` integer,
  `deleted_at` integer
);
--> statement-breakpoint
CREATE INDEX `photo_comments_photo_status_idx` ON `photo_comments` (`photo_kind`, `photo_ref`, `status`, `id`);
--> statement-breakpoint
CREATE INDEX `photo_comments_parent_created_idx` ON `photo_comments` (`parent_id`, `created_at`, `id`);
--> statement-breakpoint
CREATE INDEX `photo_comments_user_status_idx` ON `photo_comments` (`user_id`, `status`, `id`);
--> statement-breakpoint
CREATE TABLE `photo_comment_revisions` (
  `id` text PRIMARY KEY NOT NULL,
  `comment_id` text NOT NULL REFERENCES `photo_comments`(`id`) ON DELETE CASCADE,
  `editor_id` text NOT NULL REFERENCES `users`(`id`),
  `body` text NOT NULL,
  `created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `photo_comment_revisions_comment_idx` ON `photo_comment_revisions` (`comment_id`, `created_at`);
