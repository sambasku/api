-- Migration 0141: event_images - galeri foto user-generated untuk acara

CREATE TABLE `event_images` (
  `id` text PRIMARY KEY NOT NULL,
  `event_id` text NOT NULL REFERENCES `events`(`id`) ON DELETE CASCADE,
  `url` text NOT NULL,
  `attribution_json` text,
  `created_at` integer NOT NULL,
  `hidden_at` integer
);
--> statement-breakpoint
CREATE INDEX `event_images_event_id_idx` ON `event_images` (`event_id`);