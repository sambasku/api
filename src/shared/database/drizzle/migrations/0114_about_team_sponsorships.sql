ALTER TABLE `users` ADD `is_team` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD `team_as` text;--> statement-breakpoint
ALTER TABLE `users` ADD `team_note` text;--> statement-breakpoint
CREATE INDEX `users_is_team_idx` ON `users` (`is_team`);--> statement-breakpoint
CREATE TABLE `sponsorships` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text,
	`name` text NOT NULL,
	`description` text,
	`logo_url` text,
	`url` text,
	`username` text,
	`since` text NOT NULL,
	`note` text DEFAULT '' NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer,
	`deleted_at` integer,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);--> statement-breakpoint
CREATE INDEX `sponsorships_since_idx` ON `sponsorships` (`since`);--> statement-breakpoint
CREATE INDEX `sponsorships_deleted_at_idx` ON `sponsorships` (`deleted_at`);--> statement-breakpoint
CREATE UNIQUE INDEX `sponsorships_user_id_active_uidx` ON `sponsorships` (`user_id`) WHERE user_id is not null and deleted_at is null;
