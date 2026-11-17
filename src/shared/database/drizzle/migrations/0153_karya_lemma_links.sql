CREATE TABLE `karya_lemma_links` (
  `id` text PRIMARY KEY NOT NULL,
  `excerpt_id` text NOT NULL,
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
  FOREIGN KEY (`excerpt_id`) REFERENCES `karya_excerpts`(`id`) ON DELETE cascade,
  FOREIGN KEY (`word_id`) REFERENCES `words`(`id`),
  FOREIGN KEY (`proposed_word_id`) REFERENCES `words`(`id`),
  FOREIGN KEY (`proposed_by`) REFERENCES `users`(`id`),
  FOREIGN KEY (`reviewed_by`) REFERENCES `users`(`id`)
);
--> statement-breakpoint
CREATE INDEX `karya_lemma_links_excerpt_idx` ON `karya_lemma_links` (`excerpt_id`,`status`);
--> statement-breakpoint
CREATE INDEX `karya_lemma_links_word_idx` ON `karya_lemma_links` (`word_id`);
--> statement-breakpoint
CREATE UNIQUE INDEX `karya_lemma_links_excerpt_span_uidx` ON `karya_lemma_links` (`excerpt_id`,`start`,`end`);