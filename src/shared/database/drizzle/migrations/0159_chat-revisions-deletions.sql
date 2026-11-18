CREATE TABLE `chat_messages` (
	`id` text PRIMARY KEY NOT NULL,
	`channel` text DEFAULT 'public' NOT NULL,
	`user_id` text NOT NULL,
	`username` text,
	`display_name` text,
	`avatar_url` text,
	`kind` text DEFAULT 'text' NOT NULL,
	`body` text,
	`sticker_id` text,
	`audio_url` text,
	`audio_path` text,
	`audio_sha` text,
	`duration_ms` integer,
	`reply_to_id` text,
	`reply_snippet` text,
	`reply_username` text,
	`edited_at` integer,
	`deleted_at` integer,
	`deleted_by` text,
	`created_at` integer NOT NULL,
	`updated_at` integer,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`)
);
--> statement-breakpoint
CREATE INDEX `chat_messages_channel_created_idx` ON `chat_messages` (`channel`,`created_at`,`id`);
--> statement-breakpoint
CREATE INDEX `chat_messages_reply_to_idx` ON `chat_messages` (`reply_to_id`);
--> statement-breakpoint
CREATE TABLE `chat_message_revisions` (
	`id` text PRIMARY KEY NOT NULL,
	`message_id` text NOT NULL,
	`editor_id` text NOT NULL,
	`body` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`editor_id`) REFERENCES `users`(`id`)
);
--> statement-breakpoint
CREATE INDEX `chat_revisions_message_idx` ON `chat_message_revisions` (`message_id`,`created_at`);
--> statement-breakpoint
CREATE TABLE `chat_message_deletions` (
	`id` text PRIMARY KEY NOT NULL,
	`message_id` text NOT NULL,
	`deleted_by` text NOT NULL,
	`reason` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`deleted_by`) REFERENCES `users`(`id`)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `chat_deletions_message_uidx` ON `chat_message_deletions` (`message_id`);
--> statement-breakpoint
INSERT OR IGNORE INTO `app_settings` (`key`, `value`, `type`, `description`, `updated_at`)
VALUES (
	'voice.room_enabled',
	'false',
	'boolean',
	'Experimental voice room (LiveKit homelab). false = strip mobile disembunyikan.',
	unixepoch() * 1000
);
