DROP INDEX IF EXISTS `jinye_lemma_links_jinye_span_uidx`;
--> statement-breakpoint
CREATE UNIQUE INDEX `jinye_lemma_links_jinye_span_uidx` ON `jinye_lemma_links` (`jinye_id`,`start`,`end`) WHERE `comment_id` IS NULL;
--> statement-breakpoint
CREATE UNIQUE INDEX `jinye_lemma_links_comment_span_uidx` ON `jinye_lemma_links` (`comment_id`,`start`,`end`) WHERE `comment_id` IS NOT NULL;
