ALTER TABLE `contributions` ADD `reopened_by` text REFERENCES `users`(`id`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `contributions_status_reopened_by_idx` ON `contributions` (`status`,`reopened_by`);
