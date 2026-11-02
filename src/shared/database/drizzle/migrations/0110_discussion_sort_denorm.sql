-- #204: denorm untuk sort feed (activity + replies) + index.
ALTER TABLE `discussions` ADD `last_reply_at` integer;--> statement-breakpoint
ALTER TABLE `discussions` ADD `published_reply_count` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
CREATE INDEX `discussions_status_last_reply_id_idx` ON `discussions` (`status`,`last_reply_at`,`id`);--> statement-breakpoint
CREATE INDEX `discussions_status_reply_count_id_idx` ON `discussions` (`status`,`published_reply_count`,`id`);--> statement-breakpoint
-- Backfill dari balasan published.
UPDATE `discussions`
SET
  `published_reply_count` = coalesce((
    SELECT count(*)
    FROM `discussion_replies` r
    WHERE r.`discussion_id` = `discussions`.`id`
      AND r.`status` = 'published'
  ), 0),
  `last_reply_at` = (
    SELECT max(r.`created_at`)
    FROM `discussion_replies` r
    WHERE r.`discussion_id` = `discussions`.`id`
      AND r.`status` = 'published'
  );
