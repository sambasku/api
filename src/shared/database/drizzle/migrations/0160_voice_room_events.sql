CREATE TABLE `voice_room_events` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`kind` text NOT NULL,
	`room` text DEFAULT 'sambasku-global' NOT NULL,
	`error_code` text,
	`detail` text,
	`platform` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`)
);
--> statement-breakpoint
CREATE INDEX `voice_room_events_kind_created_idx` ON `voice_room_events` (`kind`,`created_at`);
--> statement-breakpoint
CREATE INDEX `voice_room_events_user_created_idx` ON `voice_room_events` (`user_id`,`created_at`);
