-- Master kategori komunitas + FK category_id di orgs/proposals.
CREATE TABLE `kategori_komunitas` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`status` text DEFAULT 'published' NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer,
	`deleted_at` integer
);
--> statement-breakpoint
CREATE INDEX `kategori_komunitas_status_idx` ON `kategori_komunitas` (`status`);--> statement-breakpoint
CREATE INDEX `kategori_komunitas_sort_idx` ON `kategori_komunitas` (`sort_order`);--> statement-breakpoint
INSERT OR IGNORE INTO `kategori_komunitas` (`id`, `name`, `sort_order`, `status`, `created_at`) VALUES
('seni', 'Seni & Budaya', 0, 'published', unixepoch()),
('bahasa', 'Bahasa', 1, 'published', unixepoch()),
('pendidikan', 'Pendidikan', 2, 'published', unixepoch()),
('ukm', 'UKM', 3, 'published', unixepoch()),
('lain', 'Lainnya', 4, 'published', unixepoch());--> statement-breakpoint
CREATE TABLE `community_orgs_new` (
	`id` text PRIMARY KEY NOT NULL,
	`slug` text NOT NULL,
	`name` text NOT NULL,
	`category_id` text DEFAULT 'lain' NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`logo_url` text,
	`cover_url` text,
	`status` text DEFAULT 'published' NOT NULL,
	`is_featured_kind` text,
	`author_id` text,
	`created_at` integer NOT NULL,
	`updated_at` integer,
	FOREIGN KEY (`category_id`) REFERENCES `kategori_komunitas`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
INSERT INTO `community_orgs_new` (
	`id`, `slug`, `name`, `category_id`, `description`, `logo_url`, `cover_url`,
	`status`, `is_featured_kind`, `author_id`, `created_at`, `updated_at`
)
SELECT
	`id`, `slug`, `name`,
	CASE
		WHEN `category` IN ('seni', 'bahasa', 'pendidikan', 'ukm', 'lain') THEN `category`
		ELSE 'lain'
	END,
	`description`, `logo_url`, `cover_url`,
	`status`, `is_featured_kind`, `author_id`, `created_at`, `updated_at`
FROM `community_orgs`;--> statement-breakpoint
DROP TABLE `community_orgs`;--> statement-breakpoint
ALTER TABLE `community_orgs_new` RENAME TO `community_orgs`;--> statement-breakpoint
CREATE UNIQUE INDEX `community_orgs_slug_uidx` ON `community_orgs` (`slug`);--> statement-breakpoint
CREATE INDEX `community_orgs_status_category_idx` ON `community_orgs` (`status`,`category_id`);--> statement-breakpoint
CREATE INDEX `community_orgs_status_created_idx` ON `community_orgs` (`status`,`created_at`);--> statement-breakpoint
CREATE UNIQUE INDEX `community_orgs_featured_kind_uidx` ON `community_orgs` (`is_featured_kind`) WHERE is_featured_kind is not null;--> statement-breakpoint
CREATE TABLE `community_proposals_new` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`name` text NOT NULL,
	`description` text NOT NULL,
	`logo_url` text,
	`category_id` text DEFAULT 'lain' NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`review_note` text,
	`reviewed_by` text,
	`reviewed_at` integer,
	`community_org_id` text,
	`created_at` integer NOT NULL,
	`updated_at` integer,
	FOREIGN KEY (`category_id`) REFERENCES `kategori_komunitas`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`community_org_id`) REFERENCES `community_orgs`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
INSERT INTO `community_proposals_new` (
	`id`, `user_id`, `name`, `description`, `logo_url`, `category_id`, `status`,
	`review_note`, `reviewed_by`, `reviewed_at`, `community_org_id`,
	`created_at`, `updated_at`
)
SELECT
	`id`, `user_id`, `name`, `description`, `logo_url`,
	CASE
		WHEN `category` IN ('seni', 'bahasa', 'pendidikan', 'ukm', 'lain') THEN `category`
		ELSE 'lain'
	END,
	`status`, `review_note`, `reviewed_by`, `reviewed_at`, `community_org_id`,
	`created_at`, `updated_at`
FROM `community_proposals`;--> statement-breakpoint
DROP TABLE `community_proposals`;--> statement-breakpoint
ALTER TABLE `community_proposals_new` RENAME TO `community_proposals`;--> statement-breakpoint
CREATE INDEX `community_proposals_user_status_idx` ON `community_proposals` (`user_id`,`status`);--> statement-breakpoint
CREATE INDEX `community_proposals_status_created_idx` ON `community_proposals` (`status`,`created_at`);
