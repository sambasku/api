-- Inbox: unique per (user, type, target) supaya word_comment + word_vote
-- pada kata yang sama tidak saling timpa. CTA tap (#19): action_kind/value.
DROP INDEX IF EXISTS `notifications_user_target_unique`;
--> statement-breakpoint
CREATE UNIQUE INDEX `notifications_user_type_target_unique` ON `notifications` (`user_id`,`type`,`target_kind`,`target_id`);
--> statement-breakpoint
ALTER TABLE `notifications` ADD `action_kind` text;
--> statement-breakpoint
ALTER TABLE `notifications` ADD `action_value` text;
--> statement-breakpoint
INSERT INTO `app_settings` (`key`, `value`, `updated_at`, `updated_by`) VALUES
	('notification.word_vote_push_cooldown_minutes', '3', unixepoch() * 1000, NULL)
ON CONFLICT(`key`) DO NOTHING;
