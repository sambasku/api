CREATE TABLE `community_orgs` (
	`id` text PRIMARY KEY NOT NULL,
	`slug` text NOT NULL,
	`name` text NOT NULL,
	`category` text DEFAULT 'lain' NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`logo_url` text,
	`cover_url` text,
	`status` text DEFAULT 'published' NOT NULL,
	`is_featured_kind` text,
	`author_id` text,
	`created_at` integer NOT NULL,
	`updated_at` integer
);
--> statement-breakpoint
CREATE UNIQUE INDEX `community_orgs_slug_uidx` ON `community_orgs` (`slug`);--> statement-breakpoint
CREATE INDEX `community_orgs_status_category_idx` ON `community_orgs` (`status`,`category`);--> statement-breakpoint
CREATE INDEX `community_orgs_status_created_idx` ON `community_orgs` (`status`,`created_at`);--> statement-breakpoint
CREATE UNIQUE INDEX `community_orgs_featured_kind_uidx` ON `community_orgs` (`is_featured_kind`) WHERE is_featured_kind is not null;--> statement-breakpoint
CREATE TABLE `community_proposals` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`name` text NOT NULL,
	`description` text NOT NULL,
	`logo_url` text,
	`category` text DEFAULT 'lain' NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`review_note` text,
	`reviewed_by` text,
	`reviewed_at` integer,
	`community_org_id` text,
	`created_at` integer NOT NULL,
	`updated_at` integer,
	FOREIGN KEY (`community_org_id`) REFERENCES `community_orgs`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `community_proposals_user_status_idx` ON `community_proposals` (`user_id`,`status`);--> statement-breakpoint
CREATE INDEX `community_proposals_status_created_idx` ON `community_proposals` (`status`,`created_at`);
