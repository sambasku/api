CREATE TABLE `comment_revisions` (
	`id` text PRIMARY KEY NOT NULL,
	`comment_id` text NOT NULL,
	`editor_id` text NOT NULL,
	`body` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`comment_id`) REFERENCES `comments`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`editor_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `comment_revisions_comment_created_idx` ON `comment_revisions` (`comment_id`,`created_at`);
--> statement-breakpoint
CREATE TABLE `discussion_reply_revisions` (
	`id` text PRIMARY KEY NOT NULL,
	`reply_id` text NOT NULL,
	`editor_id` text NOT NULL,
	`body` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`reply_id`) REFERENCES `discussion_replies`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`editor_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `discussion_reply_revisions_reply_created_idx` ON `discussion_reply_revisions` (`reply_id`,`created_at`);
--> statement-breakpoint
CREATE TABLE `pantun_reply_revisions` (
	`id` text PRIMARY KEY NOT NULL,
	`reply_id` text NOT NULL,
	`editor_id` text NOT NULL,
	`rhyme_scheme` text NOT NULL,
	`lines` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`reply_id`) REFERENCES `pantun_replies`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`editor_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `pantun_reply_revisions_reply_created_idx` ON `pantun_reply_revisions` (`reply_id`,`created_at`);
