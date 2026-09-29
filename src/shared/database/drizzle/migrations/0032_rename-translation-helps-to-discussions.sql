-- Ruang Diskusi: rename tabel translation_helps* + enum string terkait.
ALTER TABLE `translation_helps` RENAME TO `discussions`;
--> statement-breakpoint
ALTER TABLE `translation_help_replies` RENAME TO `discussion_replies`;
--> statement-breakpoint
ALTER TABLE `discussion_replies` RENAME COLUMN `help_id` TO `discussion_id`;
--> statement-breakpoint
DROP INDEX IF EXISTS `translation_helps_status_id_idx`;
--> statement-breakpoint
DROP INDEX IF EXISTS `translation_helps_user_id_idx`;
--> statement-breakpoint
DROP INDEX IF EXISTS `translation_help_replies_help_created_idx`;
--> statement-breakpoint
DROP INDEX IF EXISTS `translation_help_replies_status_idx`;
--> statement-breakpoint
CREATE INDEX `discussions_status_id_idx` ON `discussions` (`status`,`id`);
--> statement-breakpoint
CREATE INDEX `discussions_user_id_idx` ON `discussions` (`user_id`,`id`);
--> statement-breakpoint
CREATE INDEX `discussion_replies_discussion_created_idx` ON `discussion_replies` (`discussion_id`,`created_at`,`id`);
--> statement-breakpoint
CREATE INDEX `discussion_replies_status_idx` ON `discussion_replies` (`status`,`id`);
--> statement-breakpoint
UPDATE `votes` SET `entity_type` = 'discussion' WHERE `entity_type` = 'translation_help';
--> statement-breakpoint
UPDATE `votes` SET `entity_type` = 'discussion_reply' WHERE `entity_type` = 'translation_help_reply';
--> statement-breakpoint
UPDATE `notifications` SET `type` = 'discussion_approved' WHERE `type` = 'translation_help_approved';
--> statement-breakpoint
UPDATE `notifications` SET `type` = 'discussion_rejected' WHERE `type` = 'translation_help_rejected';
--> statement-breakpoint
UPDATE `notifications` SET `type` = 'discussion_taken_down' WHERE `type` = 'translation_help_taken_down';
--> statement-breakpoint
UPDATE `notifications` SET `target_kind` = 'discussion' WHERE `target_kind` = 'translation_help';
--> statement-breakpoint
UPDATE `notifications` SET `action_kind` = 'discussion' WHERE `action_kind` = 'translation_help';
--> statement-breakpoint
UPDATE `audit_logs` SET `entity_type` = 'discussion' WHERE `entity_type` = 'translation_help';
--> statement-breakpoint
UPDATE `audit_logs` SET `entity_type` = 'discussion_reply' WHERE `entity_type` = 'translation_help_reply';
--> statement-breakpoint
UPDATE `api_clients` SET `allowed_scopes` = REPLACE(`allowed_scopes`, 'translation_help.write', 'discussion.write')
WHERE `allowed_scopes` LIKE '%translation_help.write%';
