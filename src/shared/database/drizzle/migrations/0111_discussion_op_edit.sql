-- #202: edit OP published + batalkan penayangan (deleted_by_author)
ALTER TABLE `discussions` ADD `body_original` text;--> statement-breakpoint
CREATE TABLE `discussion_revisions` (
	`id` text PRIMARY KEY NOT NULL,
	`discussion_id` text NOT NULL,
	`editor_id` text NOT NULL,
	`body` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`discussion_id`) REFERENCES `discussions`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`editor_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `discussion_revisions_discussion_created_idx` ON `discussion_revisions` (`discussion_id`,`created_at`);
