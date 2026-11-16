-- Migration 0147: jinye_comment_revisions
-- Mirror pola event_comment_revisions / comment_revisions (cap 50 di aplikasi).

CREATE TABLE `jinye_comment_revisions` (
  `id` text PRIMARY KEY NOT NULL,
  `comment_id` text NOT NULL REFERENCES `jinye_comments`(`id`) ON DELETE CASCADE,
  `editor_id` text NOT NULL REFERENCES `users`(`id`),
  `body` text NOT NULL,
  `created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `jinye_comment_revisions_comment_idx` ON `jinye_comment_revisions` (`comment_id`, `created_at`);
