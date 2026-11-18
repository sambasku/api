CREATE TABLE `content_links` (
  `id` text PRIMARY KEY NOT NULL,
  `a_kind` text NOT NULL,
  `a_id` text NOT NULL,
  `b_kind` text NOT NULL,
  `b_id` text NOT NULL,
  `created_by` text,
  `created_at` integer NOT NULL,
  `updated_at` integer,
  FOREIGN KEY (`created_by`) REFERENCES `users`(`id`)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `content_links_pair_uidx` ON `content_links` (`a_kind`,`a_id`,`b_kind`,`b_id`);
--> statement-breakpoint
CREATE INDEX `content_links_a_idx` ON `content_links` (`a_kind`,`a_id`);
--> statement-breakpoint
CREATE INDEX `content_links_b_idx` ON `content_links` (`b_kind`,`b_id`);
