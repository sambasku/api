CREATE TABLE `article_claps` (
  `id` text PRIMARY KEY NOT NULL,
  `user_id` text NOT NULL,
  `article_id` text NOT NULL,
  `count` integer DEFAULT 1 NOT NULL,
  `created_at` integer NOT NULL,
  `updated_at` integer NOT NULL,
  FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
  FOREIGN KEY (`article_id`) REFERENCES `articles`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `article_claps_user_article_uidx` ON `article_claps` (`user_id`,`article_id`);
--> statement-breakpoint
CREATE INDEX `article_claps_article_idx` ON `article_claps` (`article_id`);
--> statement-breakpoint
CREATE INDEX `article_claps_user_idx` ON `article_claps` (`user_id`,`id`);