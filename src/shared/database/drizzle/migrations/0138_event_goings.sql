-- Migration 0138: event_goings - soft RSVP "berencana datang"

CREATE TABLE `event_goings` (
  `id` text PRIMARY KEY NOT NULL,
  `event_id` text NOT NULL REFERENCES `events`(`id`) ON DELETE CASCADE,
  `user_id` text NOT NULL REFERENCES `users`(`id`),
  `created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `event_goings_user_event_uidx` ON `event_goings` (`user_id`, `event_id`);
--> statement-breakpoint
CREATE INDEX `event_goings_event_idx` ON `event_goings` (`event_id`, `created_at`, `id`);
--> statement-breakpoint
CREATE INDEX `event_goings_user_idx` ON `event_goings` (`user_id`, `id`);
