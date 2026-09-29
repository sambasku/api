ALTER TABLE `words` ADD `import_session_id` text REFERENCES `word_import_sessions`(`id`);--> statement-breakpoint
CREATE INDEX `words_import_session_id_idx` ON `words` (`import_session_id`);--> statement-breakpoint
ALTER TABLE `word_import_sessions` ADD `rolled_back_at` integer;--> statement-breakpoint
ALTER TABLE `word_import_sessions` ADD `rolled_back_by` text REFERENCES `users`(`id`);
