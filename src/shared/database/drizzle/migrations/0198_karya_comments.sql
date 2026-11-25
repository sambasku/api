-- Migration 0198: karya_comments + karya_comment_revisions
-- Mirror event_comments (0137 + 0167): termasuk kolom media stiker/audio/gambar.

CREATE TABLE `karya_comments` (
  `id` text PRIMARY KEY NOT NULL,
  `karya_id` text NOT NULL REFERENCES `karyas`(`id`) ON DELETE CASCADE,
  `user_id` text NOT NULL REFERENCES `users`(`id`),
  `body` text NOT NULL,
  `body_original` text,
  `sticker_id` text,
  `audio_url` text,
  `audio_mime_type` text,
  `audio_file_size` integer,
  `audio_duration_ms` integer,
  `audio_provider` text,
  `audio_provider_file_id` text,
  `audio_sha` text,
  `image_url` text,
  `image_provider` text,
  `image_provider_file_id` text,
  `image_public_url` text,
  `image_status` text,
  `image_content_warnings` text,
  `image_reviewed_by` text REFERENCES `users`(`id`),
  `image_reviewed_at` integer,
  `status` text NOT NULL DEFAULT 'published',
  `reviewed_by` text REFERENCES `users`(`id`),
  `reviewed_at` integer,
  `created_at` integer NOT NULL,
  `updated_at` integer,
  `deleted_at` integer
);
--> statement-breakpoint
CREATE INDEX `karya_comments_karya_status_idx` ON `karya_comments` (`karya_id`, `status`, `id`);
--> statement-breakpoint
CREATE INDEX `karya_comments_user_status_idx` ON `karya_comments` (`user_id`, `status`, `id`);
--> statement-breakpoint
CREATE INDEX `karya_comments_image_status_idx` ON `karya_comments` (`image_status`, `id`);
--> statement-breakpoint
CREATE TABLE `karya_comment_revisions` (
  `id` text PRIMARY KEY NOT NULL,
  `comment_id` text NOT NULL REFERENCES `karya_comments`(`id`) ON DELETE CASCADE,
  `editor_id` text NOT NULL REFERENCES `users`(`id`),
  `body` text NOT NULL,
  `created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `karya_comment_revisions_comment_idx` ON `karya_comment_revisions` (`comment_id`, `created_at`);
