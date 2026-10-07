CREATE TABLE `category_suggestions` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`reason` text,
	`status` text NOT NULL DEFAULT 'pending',
	`proposed_by` text,
	`contributor_name` text,
	`word_suggestion_id` text,
	`reviewed_by` text,
	`reviewed_at` integer,
	`reject_reason` text,
	`created_at` integer NOT NULL,
	`updated_at` integer,
	FOREIGN KEY (`proposed_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`reviewed_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `category_suggestions_pending_name_idx` ON `category_suggestions`(`name`) WHERE status = 'pending';--> statement-breakpoint
CREATE INDEX `category_suggestions_status_idx` ON `category_suggestions`(`status`,`created_at`);
