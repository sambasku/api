-- Migration 0148: Baleho - papan iklan publik (docs/BALEHO.md)
-- Creative = aset konten; placement = instance tayang; occupancy = kunci sel.

CREATE TABLE `baleho_creatives` (
  `id` text PRIMARY KEY NOT NULL,
  `owner_user_id` text NOT NULL,
  `fingerprint` text NOT NULL,
  `moderation_status` text DEFAULT 'pending' NOT NULL,
  `created_at` integer NOT NULL,
  `updated_at` integer,
  `deleted_at` integer,
  FOREIGN KEY (`owner_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `baleho_creatives_owner_idx` ON `baleho_creatives` (`owner_user_id`);
--> statement-breakpoint
CREATE INDEX `baleho_creatives_fingerprint_idx` ON `baleho_creatives` (`owner_user_id`, `fingerprint`);
--> statement-breakpoint
CREATE TABLE `baleho_frames` (
  `id` text PRIMARY KEY NOT NULL,
  `creative_id` text NOT NULL,
  `sort_order` integer DEFAULT 0 NOT NULL,
  `media_type` text NOT NULL,
  `media_url` text,
  `title` text,
  `cta_label` text,
  `action_type` text NOT NULL,
  `action_payload` text NOT NULL,
  `created_at` integer NOT NULL,
  `updated_at` integer,
  FOREIGN KEY (`creative_id`) REFERENCES `baleho_creatives`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `baleho_frames_creative_sort_idx` ON `baleho_frames` (`creative_id`, `sort_order`);
--> statement-breakpoint
CREATE TABLE `baleho_placements` (
  `id` text PRIMARY KEY NOT NULL,
  `creative_id` text NOT NULL,
  `slide` integer NOT NULL,
  `col` integer NOT NULL,
  `row` integer NOT NULL,
  `w` integer NOT NULL,
  `h` integer NOT NULL,
  `status` text DEFAULT 'pending_review' NOT NULL,
  `advertiser_user_id` text NOT NULL,
  `referrer_user_id` text,
  `referral_username` text,
  `entity_type` text,
  `entity_id` text,
  `starts_at` integer,
  `ends_at` integer,
  `awaiting_payment_at` integer,
  `paid_at` integer,
  `rejected_at` integer,
  `reject_reason` text,
  `created_at` integer NOT NULL,
  `updated_at` integer,
  `deleted_at` integer,
  FOREIGN KEY (`creative_id`) REFERENCES `baleho_creatives`(`id`) ON UPDATE no action ON DELETE no action,
  FOREIGN KEY (`advertiser_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
  FOREIGN KEY (`referrer_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `baleho_placements_slide_status_idx` ON `baleho_placements` (`slide`, `status`);
--> statement-breakpoint
CREATE INDEX `baleho_placements_advertiser_status_idx` ON `baleho_placements` (`advertiser_user_id`, `status`);
--> statement-breakpoint
CREATE INDEX `baleho_placements_referrer_idx` ON `baleho_placements` (`referrer_user_id`);
--> statement-breakpoint
CREATE TABLE `baleho_occupancy` (
  `slide` integer NOT NULL,
  `col` integer NOT NULL,
  `row` integer NOT NULL,
  `placement_id` text NOT NULL,
  PRIMARY KEY (`slide`, `col`, `row`),
  FOREIGN KEY (`placement_id`) REFERENCES `baleho_placements`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `baleho_occupancy_placement_idx` ON `baleho_occupancy` (`placement_id`);
--> statement-breakpoint
CREATE TABLE `baleho_commissions` (
  `id` text PRIMARY KEY NOT NULL,
  `placement_id` text NOT NULL,
  `referrer_user_id` text NOT NULL,
  `amount` integer DEFAULT 0 NOT NULL,
  `currency` text DEFAULT 'IDR' NOT NULL,
  `status` text DEFAULT 'unclaimed' NOT NULL,
  `claimed_at` integer,
  `created_at` integer NOT NULL,
  `updated_at` integer,
  FOREIGN KEY (`placement_id`) REFERENCES `baleho_placements`(`id`) ON UPDATE no action ON DELETE no action,
  FOREIGN KEY (`referrer_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `baleho_commissions_placement_uidx` ON `baleho_commissions` (`placement_id`);
--> statement-breakpoint
CREATE INDEX `baleho_commissions_referrer_status_idx` ON `baleho_commissions` (`referrer_user_id`, `status`);
--> statement-breakpoint
CREATE TABLE `baleho_events` (
  `id` text PRIMARY KEY NOT NULL,
  `placement_id` text NOT NULL,
  `frame_id` text,
  `event_type` text NOT NULL,
  `created_at` integer NOT NULL,
  FOREIGN KEY (`placement_id`) REFERENCES `baleho_placements`(`id`) ON UPDATE no action ON DELETE cascade,
  FOREIGN KEY (`frame_id`) REFERENCES `baleho_frames`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `baleho_events_placement_type_idx` ON `baleho_events` (`placement_id`, `event_type`);
--> statement-breakpoint
CREATE INDEX `baleho_events_created_idx` ON `baleho_events` (`created_at`);
