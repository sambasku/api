CREATE TABLE `word_card_shares` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`word_id` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`word_id`) REFERENCES `words`(`id`) ON UPDATE no action ON DELETE no action
);--> statement-breakpoint
CREATE INDEX `word_card_shares_created_idx` ON `word_card_shares` (`created_at`,`id`);--> statement-breakpoint
CREATE INDEX `word_card_shares_user_word_idx` ON `word_card_shares` (`user_id`,`word_id`,`created_at`);
