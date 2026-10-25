-- Issue mobile#196: cek versi terbaru per platform untuk banner update
-- di mobile. Satu baris per platform (UNIQUE), admin upsert dari console
-- System > Mobile Release.
CREATE TABLE `mobile_releases` (
	`id` text PRIMARY KEY NOT NULL,
	`platform` text NOT NULL,
	`version` text NOT NULL,
	`store_url` text,
	`notes` text,
	`created_at` integer NOT NULL,
	`updated_at` integer
);
--> statement-breakpoint
CREATE UNIQUE INDEX `mobile_releases_platform_unique` ON `mobile_releases` (`platform`);
