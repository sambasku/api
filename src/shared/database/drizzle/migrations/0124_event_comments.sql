-- Migration 0124: event_comments + event_comment_revisions
-- Mirror pola article_comments / article_comment_revisions di encyclopedia.

CREATE TABLE `event_comments` (
  `id` text PRIMARY KEY NOT NULL,
  `event_id` text NOT NULL REFERENCES `events`(`id`) ON DELETE CASCADE,
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

CREATE INDEX `event_comments_event_status_idx` ON `event_comments` (`event_id`, `status`, `id`);
CREATE INDEX `event_comments_user_status_idx` ON `event_comments` (`user_id`, `status`, `id`);

CREATE TABLE `event_comment_revisions` (
  `id` text PRIMARY KEY NOT NULL,
  `comment_id` text NOT NULL REFERENCES `event_comments`(`id`) ON DELETE CASCADE,
  `editor_id` text NOT NULL REFERENCES `users`(`id`),
  `body` text NOT NULL,
  `created_at` integer NOT NULL
);

CREATE INDEX `event_comment_revisions_comment_idx` ON `event_comment_revisions` (`comment_id`, `created_at`);
