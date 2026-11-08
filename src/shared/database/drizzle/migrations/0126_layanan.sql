-- Migration 0126: layanan publik (ambulans + pemadam) per kecamatan

CREATE TABLE `layanans` (
  `id` text PRIMARY KEY NOT NULL,
  `slug` text NOT NULL,
  `category` text NOT NULL,
  `name` text NOT NULL,
  `phone` text NOT NULL,
  `whatsapp` text,
  `address_text` text,
  `lat` real,
  `lng` real,
  `maps_url` text,
  `region_id` text NOT NULL,
  `village_id` text,
  `note` text,
  `publish_status` text NOT NULL DEFAULT 'published',
  `author_id` text,
  `created_at` integer NOT NULL,
  `updated_at` integer
);
--> statement-breakpoint
CREATE UNIQUE INDEX `layanans_slug_uidx` ON `layanans` (`slug`);
--> statement-breakpoint
CREATE INDEX `layanans_region_status_idx` ON `layanans` (`region_id`, `publish_status`, `category`);
--> statement-breakpoint
CREATE TABLE `layanan_contributions` (
  `id` text PRIMARY KEY NOT NULL,
  `kind` text NOT NULL,
  `user_id` text NOT NULL,
  `layanan_id` text,
  `payload_json` text NOT NULL,
  `status` text NOT NULL DEFAULT 'pending',
  `result_layanan_id` text,
  `revision_note` text,
  `reject_reason_code` text,
  `reject_reason_text` text,
  `created_at` integer NOT NULL,
  `updated_at` integer,
  `reviewed_at` integer
);
--> statement-breakpoint
CREATE INDEX `layanan_contributions_user_status_idx` ON `layanan_contributions` (`user_id`, `status`);
--> statement-breakpoint
CREATE INDEX `layanan_contributions_status_created_idx` ON `layanan_contributions` (`status`, `created_at`);
