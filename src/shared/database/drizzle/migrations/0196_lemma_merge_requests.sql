CREATE TABLE `lemma_merge_requests` (
	`id` text PRIMARY KEY NOT NULL,
	`proposer_id` text NOT NULL,
	`keep_word_id` text NOT NULL,
	`merge_word_ids` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`reason_text` text,
	`reviewed_by` text,
	`reviewed_at` integer,
	`review_note` text,
	`created_at` integer NOT NULL,
	`updated_at` integer,
	FOREIGN KEY (`proposer_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`keep_word_id`) REFERENCES `words`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`reviewed_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `lemma_merge_requests_status_created_idx` ON `lemma_merge_requests` (`status`,`created_at`);
--> statement-breakpoint
CREATE INDEX `lemma_merge_requests_proposer_idx` ON `lemma_merge_requests` (`proposer_id`,`created_at`);
--> statement-breakpoint
CREATE INDEX `lemma_merge_requests_keep_idx` ON `lemma_merge_requests` (`keep_word_id`);