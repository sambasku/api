ALTER TABLE `users` ADD `contribute_muted_until` integer;--> statement-breakpoint
CREATE TABLE `ugc_abuse_events` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`signal` text NOT NULL,
	`weight` integer DEFAULT 0 NOT NULL,
	`entity_type` text,
	`entity_id` text,
	`meta` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);--> statement-breakpoint
CREATE INDEX `ugc_abuse_events_user_created_idx` ON `ugc_abuse_events` (`user_id`,`created_at`);
