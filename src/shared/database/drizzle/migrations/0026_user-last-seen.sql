ALTER TABLE `users` ADD `last_seen_at` integer;--> statement-breakpoint
CREATE INDEX `users_last_seen_at_idx` ON `users` (`last_seen_at`);
