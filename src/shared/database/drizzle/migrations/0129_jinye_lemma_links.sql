CREATE TABLE `jinye_lemma_links` (
  `id` text PRIMARY KEY NOT NULL,
  `jinye_id` text,
  `comment_id` text,
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
  FOREIGN KEY (`jinye_id`) REFERENCES `jinye`(`id`),
  FOREIGN KEY (`comment_id`) REFERENCES `jinye_comments`(`id`),
  FOREIGN KEY (`word_id`) REFERENCES `words`(`id`),
  FOREIGN KEY (`proposed_word_id`) REFERENCES `words`(`id`),
  FOREIGN KEY (`proposed_by`) REFERENCES `users`(`id`),
  FOREIGN KEY (`reviewed_by`) REFERENCES `users`(`id`)
);
--> statement-breakpoint
CREATE INDEX `jinye_lemma_links_jinye_idx` ON `jinye_lemma_links` (`jinye_id`,`status`);
--> statement-breakpoint
CREATE INDEX `jinye_lemma_links_comment_idx` ON `jinye_lemma_links` (`comment_id`,`status`);
--> statement-breakpoint
CREATE INDEX `jinye_lemma_links_word_idx` ON `jinye_lemma_links` (`word_id`);
--> statement-breakpoint
CREATE UNIQUE INDEX `jinye_lemma_links_jinye_span_uidx` ON `jinye_lemma_links` (`jinye_id`,`start`,`end`);
