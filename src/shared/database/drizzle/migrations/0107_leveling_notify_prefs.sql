ALTER TABLE `users` ADD `level_seen` integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD `notify_streak_reminder` integer DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD `notify_level_up` integer DEFAULT true NOT NULL;
