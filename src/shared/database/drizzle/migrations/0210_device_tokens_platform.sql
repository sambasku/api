-- Identifikasi platform device (android | ios) dan target platform campaign (all | android | ios).
ALTER TABLE `device_tokens` ADD `platform` text NOT NULL DEFAULT 'android';--> statement-breakpoint
CREATE INDEX `device_tokens_active_platform_idx` ON `device_tokens` (`platform`) WHERE deleted_at is null;--> statement-breakpoint
ALTER TABLE `notification_campaigns` ADD `target_platform` text NOT NULL DEFAULT 'all';
