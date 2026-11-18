-- Migration 0166: place/usaha visits + place/usaha/cuisine comments (Slice 1+2)
-- Mirror pola event_goings + event_comments.

CREATE TABLE `place_visits` (
  `id` text PRIMARY KEY NOT NULL,
  `place_id` text NOT NULL REFERENCES `places`(`id`) ON DELETE CASCADE,
  `user_id` text NOT NULL REFERENCES `users`(`id`),
  `created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `place_visits_user_place_uidx` ON `place_visits` (`user_id`, `place_id`);
--> statement-breakpoint
CREATE INDEX `place_visits_place_idx` ON `place_visits` (`place_id`, `created_at`, `id`);
--> statement-breakpoint
CREATE INDEX `place_visits_user_idx` ON `place_visits` (`user_id`, `id`);
--> statement-breakpoint
CREATE TABLE `usaha_visits` (
  `id` text PRIMARY KEY NOT NULL,
  `usaha_id` text NOT NULL REFERENCES `usahas`(`id`) ON DELETE CASCADE,
  `user_id` text NOT NULL REFERENCES `users`(`id`),
  `created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `usaha_visits_user_usaha_uidx` ON `usaha_visits` (`user_id`, `usaha_id`);
--> statement-breakpoint
CREATE INDEX `usaha_visits_usaha_idx` ON `usaha_visits` (`usaha_id`, `created_at`, `id`);
--> statement-breakpoint
CREATE INDEX `usaha_visits_user_idx` ON `usaha_visits` (`user_id`, `id`);
--> statement-breakpoint
CREATE TABLE `place_comments` (
  `id` text PRIMARY KEY NOT NULL,
  `place_id` text NOT NULL REFERENCES `places`(`id`) ON DELETE CASCADE,
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
CREATE INDEX `place_comments_place_status_idx` ON `place_comments` (`place_id`, `status`, `id`);
--> statement-breakpoint
CREATE INDEX `place_comments_user_status_idx` ON `place_comments` (`user_id`, `status`, `id`);
--> statement-breakpoint
CREATE TABLE `place_comment_revisions` (
  `id` text PRIMARY KEY NOT NULL,
  `comment_id` text NOT NULL REFERENCES `place_comments`(`id`) ON DELETE CASCADE,
  `editor_id` text NOT NULL REFERENCES `users`(`id`),
  `body` text NOT NULL,
  `created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `place_comment_revisions_comment_idx` ON `place_comment_revisions` (`comment_id`, `created_at`);
--> statement-breakpoint
CREATE TABLE `usaha_comments` (
  `id` text PRIMARY KEY NOT NULL,
  `usaha_id` text NOT NULL REFERENCES `usahas`(`id`) ON DELETE CASCADE,
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
CREATE INDEX `usaha_comments_usaha_status_idx` ON `usaha_comments` (`usaha_id`, `status`, `id`);
--> statement-breakpoint
CREATE INDEX `usaha_comments_user_status_idx` ON `usaha_comments` (`user_id`, `status`, `id`);
--> statement-breakpoint
CREATE TABLE `usaha_comment_revisions` (
  `id` text PRIMARY KEY NOT NULL,
  `comment_id` text NOT NULL REFERENCES `usaha_comments`(`id`) ON DELETE CASCADE,
  `editor_id` text NOT NULL REFERENCES `users`(`id`),
  `body` text NOT NULL,
  `created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `usaha_comment_revisions_comment_idx` ON `usaha_comment_revisions` (`comment_id`, `created_at`);
--> statement-breakpoint
CREATE TABLE `cuisine_comments` (
  `id` text PRIMARY KEY NOT NULL,
  `cuisine_id` text NOT NULL REFERENCES `cuisines`(`id`) ON DELETE CASCADE,
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
CREATE INDEX `cuisine_comments_cuisine_status_idx` ON `cuisine_comments` (`cuisine_id`, `status`, `id`);
--> statement-breakpoint
CREATE INDEX `cuisine_comments_user_status_idx` ON `cuisine_comments` (`user_id`, `status`, `id`);
--> statement-breakpoint
CREATE TABLE `cuisine_comment_revisions` (
  `id` text PRIMARY KEY NOT NULL,
  `comment_id` text NOT NULL REFERENCES `cuisine_comments`(`id`) ON DELETE CASCADE,
  `editor_id` text NOT NULL REFERENCES `users`(`id`),
  `body` text NOT NULL,
  `created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `cuisine_comment_revisions_comment_idx` ON `cuisine_comment_revisions` (`comment_id`, `created_at`);