ALTER TABLE `users` ADD `pinned_jinye_id` text REFERENCES jinye(id);
--> statement-breakpoint
CREATE INDEX `users_pinned_jinye_idx` ON `users` (`pinned_jinye_id`);
