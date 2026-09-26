CREATE TABLE `notification_push_cooldowns` (
	`user_id` text NOT NULL,
	`channel` text NOT NULL,
	`last_push_at` integer NOT NULL,
	PRIMARY KEY(`user_id`, `channel`),
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
INSERT INTO `app_settings` (`key`, `value`, `updated_at`, `updated_by`) VALUES
	('notification.review_approve_push_cooldown_minutes', '360', unixepoch() * 1000, NULL),
	('notification.review_reject_push_cooldown_minutes', '360', unixepoch() * 1000, NULL);
