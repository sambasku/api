-- Jinye Phase 2: komen + reply 1 level (± foto staging).
CREATE TABLE `jinye_comments` (
  `id` text PRIMARY KEY NOT NULL,
  `jinye_id` text NOT NULL,
  `parent_id` text,
  `user_id` text NOT NULL,
  `body` text DEFAULT '' NOT NULL,
  `body_original` text,
  `images` text DEFAULT '[]' NOT NULL,
  `status` text DEFAULT 'published' NOT NULL,
  `taken_down_by` text,
  `taken_down_at` integer,
  `created_at` integer NOT NULL,
  `updated_at` integer,
  FOREIGN KEY (`jinye_id`) REFERENCES `jinye`(`id`) ON UPDATE no action ON DELETE cascade,
  FOREIGN KEY (`user_id`) REFERENCES `users`(`id`),
  FOREIGN KEY (`taken_down_by`) REFERENCES `users`(`id`)
);
--> statement-breakpoint
CREATE INDEX `jinye_comments_jinye_created_idx` ON `jinye_comments` (`jinye_id`,`created_at`,`id`);
--> statement-breakpoint
CREATE INDEX `jinye_comments_parent_created_idx` ON `jinye_comments` (`parent_id`,`created_at`,`id`);
--> statement-breakpoint
CREATE INDEX `jinye_comments_status_idx` ON `jinye_comments` (`status`,`id`);
