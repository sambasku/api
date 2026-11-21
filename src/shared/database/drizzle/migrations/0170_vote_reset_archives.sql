-- G2b: arsip vote sebelum dihapus saat konten makna berubah (usulan/edit).
CREATE TABLE `vote_reset_archives` (
	`id` text PRIMARY KEY NOT NULL,
	`batch_id` text NOT NULL,
	`vote_id` text NOT NULL,
	`user_id` text NOT NULL,
	`entity_type` text NOT NULL,
	`entity_id` text NOT NULL,
	`value` integer NOT NULL,
	`client_id` text,
	`voted_at` integer NOT NULL,
	`vote_updated_at` integer,
	`reason` text NOT NULL,
	`suggestion_id` text,
	`actor_id` text NOT NULL,
	`word_id` text,
	`reset_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `vote_reset_archives_batch_idx` ON `vote_reset_archives` (`batch_id`);
--> statement-breakpoint
CREATE INDEX `vote_reset_archives_entity_idx` ON `vote_reset_archives` (`entity_type`,`entity_id`);
--> statement-breakpoint
CREATE INDEX `vote_reset_archives_reset_at_idx` ON `vote_reset_archives` (`reset_at`);
