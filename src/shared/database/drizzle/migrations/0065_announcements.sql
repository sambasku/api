CREATE TABLE `announcements` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`body` text NOT NULL,
	`action_url` text,
	`action_label` text,
	`created_by` text NOT NULL REFERENCES users(id),
	`expires_at` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer,
	`deleted_at` integer
);
--> statement-breakpoint
CREATE INDEX `announcements_created_at_idx` ON `announcements` (`created_at`);
