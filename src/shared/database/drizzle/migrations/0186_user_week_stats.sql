-- Riwayat poin mingguan per user: snapshot skor leaderboard 5/3/2/2
-- + total XP leveling saat minggu berakhir (docs/api/31-api-leaderboard.md).
CREATE TABLE `user_week_stats` (
  `id` text PRIMARY KEY NOT NULL,
  `user_id` text NOT NULL,
  `week_id` text NOT NULL,
  `submitted_points` integer NOT NULL DEFAULT 0,
  `approved_points` integer NOT NULL DEFAULT 0,
  `verification_points` integer NOT NULL DEFAULT 0,
  `combined` integer NOT NULL DEFAULT 0,
  `xp_at_week_end` integer NOT NULL DEFAULT 0,
  `created_at` integer NOT NULL,
  FOREIGN KEY (`user_id`) REFERENCES `users`(`id`),
  UNIQUE (`user_id`, `week_id`)
);
--> statement-breakpoint
CREATE INDEX `user_week_stats_week_idx` ON `user_week_stats` (`week_id`);
--> statement-breakpoint
CREATE INDEX `user_week_stats_user_idx` ON `user_week_stats` (`user_id`);
