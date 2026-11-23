CREATE TABLE `ugc_comment_lemma_links` (
	`id` text PRIMARY KEY NOT NULL,
	`anchor_kind` text NOT NULL,
	`host_id` text NOT NULL,
	`comment_id` text NOT NULL,
	`start` integer NOT NULL,
	`end` integer NOT NULL,
	`word_id` text NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`source` text DEFAULT 'author' NOT NULL,
	`proposed_word_id` text,
	`proposed_by` text,
	`reviewed_by` text,
	`reviewed_at` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer,
	FOREIGN KEY (`word_id`) REFERENCES `words`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`proposed_word_id`) REFERENCES `words`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`proposed_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`reviewed_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `ugc_comment_lemma_host_comment_idx` ON `ugc_comment_lemma_links` (`anchor_kind`,`host_id`,`comment_id`,`status`);--> statement-breakpoint
CREATE UNIQUE INDEX `ugc_comment_lemma_span_uniq` ON `ugc_comment_lemma_links` (`anchor_kind`,`comment_id`,`start`,`end`) WHERE status in ('active', 'pending_correction');