ALTER TABLE `users` ADD `username_changed_at` integer;--> statement-breakpoint
CREATE TABLE `username_changes` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`old_username` text NOT NULL,
	`new_username` text NOT NULL,
	`changed_at` integer NOT NULL,
	`hold_until` integer NOT NULL,
	`released_at` integer,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `username_changes_user_changed_idx` ON `username_changes` (`user_id`,`changed_at`);--> statement-breakpoint
CREATE INDEX `username_changes_old_username_idx` ON `username_changes` (`old_username`);--> statement-breakpoint
CREATE INDEX `username_changes_active_hold_idx` ON `username_changes` (`old_username`) WHERE released_at is null;