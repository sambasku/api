CREATE TABLE `discussion_lemma_links` (
  `id` text PRIMARY KEY NOT NULL,
  `discussion_id` text NOT NULL,
  `reply_id` text,
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
  FOREIGN KEY (`discussion_id`) REFERENCES `discussions`(`id`),
  FOREIGN KEY (`reply_id`) REFERENCES `discussion_replies`(`id`),
  FOREIGN KEY (`word_id`) REFERENCES `words`(`id`),
  FOREIGN KEY (`proposed_word_id`) REFERENCES `words`(`id`),
  FOREIGN KEY (`proposed_by`) REFERENCES `users`(`id`),
  FOREIGN KEY (`reviewed_by`) REFERENCES `users`(`id`)
);
--> statement-breakpoint
CREATE INDEX `discussion_lemma_links_discussion_idx` ON `discussion_lemma_links` (`discussion_id`,`status`);
--> statement-breakpoint
CREATE INDEX `discussion_lemma_links_reply_idx` ON `discussion_lemma_links` (`reply_id`,`status`);
--> statement-breakpoint
CREATE INDEX `discussion_lemma_links_word_idx` ON `discussion_lemma_links` (`word_id`);
--> statement-breakpoint
CREATE UNIQUE INDEX `discussion_lemma_links_discussion_span_uidx` ON `discussion_lemma_links` (`discussion_id`,`start`,`end`) WHERE `reply_id` IS NULL;
--> statement-breakpoint
CREATE UNIQUE INDEX `discussion_lemma_links_reply_span_uidx` ON `discussion_lemma_links` (`reply_id`,`start`,`end`) WHERE `reply_id` IS NOT NULL;
