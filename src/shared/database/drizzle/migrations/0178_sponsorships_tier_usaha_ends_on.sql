ALTER TABLE `sponsorships` ADD `usaha_id` text REFERENCES `usahas`(`id`) ON DELETE set null;--> statement-breakpoint
ALTER TABLE `sponsorships` ADD `tier` text DEFAULT 'perak' NOT NULL;--> statement-breakpoint
ALTER TABLE `sponsorships` ADD `ends_on` text;--> statement-breakpoint
CREATE INDEX `sponsorships_usaha_id_idx` ON `sponsorships` (`usaha_id`);--> statement-breakpoint
CREATE INDEX `sponsorships_tier_idx` ON `sponsorships` (`tier`);--> statement-breakpoint
CREATE UNIQUE INDEX `sponsorships_usaha_id_active_uidx` ON `sponsorships` (`usaha_id`) WHERE usaha_id is not null and deleted_at is null;
