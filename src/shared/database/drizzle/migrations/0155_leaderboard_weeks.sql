-- Papan peringkat mingguan: snapshot minggu + top-N entries.
-- Skor live dihitung ulang dari contributions / contribution_reviews;
-- tabel ini hanya menyimpan hasil finalize (dan baris minggu berjalan untuk
-- tracking refresh). Lihat docs/LEADERBOARD_WEEKLY_PLAN.md.
CREATE TABLE `leaderboard_weeks` (
`id` text PRIMARY KEY NOT NULL,
`week_id` text NOT NULL,
`started_at` integer NOT NULL,
`ended_at` integer NOT NULL,
`metric` text DEFAULT 'combined' NOT NULL,
`finalized_at` integer,
`published_url` text,
`updated_at` integer,
`created_at` integer NOT NULL,
`deleted_at` integer,
`deleted_by` text REFERENCES users(id)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `leaderboard_weeks_week_id_unique` ON `leaderboard_weeks` (`week_id`);
--> statement-breakpoint
CREATE INDEX `leaderboard_weeks_finalized_idx` ON `leaderboard_weeks` (`finalized_at`);
--> statement-breakpoint
CREATE TABLE `leaderboard_week_entries` (
`id` text PRIMARY KEY NOT NULL,
`week_id` text NOT NULL,
`user_id` text NOT NULL REFERENCES users(id),
`rank` integer NOT NULL,
`username` text NOT NULL,
`avatar_url` text,
`contributions` integer NOT NULL,
`verifications` integer NOT NULL,
`combined` integer NOT NULL,
`is_verifier` integer DEFAULT 0 NOT NULL,
`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `leaderboard_week_entries_week_user_unique` ON `leaderboard_week_entries` (`week_id`,`user_id`);
--> statement-breakpoint
CREATE INDEX `leaderboard_week_entries_week_idx` ON `leaderboard_week_entries` (`week_id`);
--> statement-breakpoint
CREATE INDEX `leaderboard_week_entries_user_idx` ON `leaderboard_week_entries` (`user_id`);
--> statement-breakpoint
CREATE INDEX `leaderboard_week_entries_rank_idx` ON `leaderboard_week_entries` (`week_id`,`rank`);
--> statement-breakpoint
-- Bantu agregat live: status + created_at (approval tanpa updated_at di
-- contributions; window skor kontribusi memakai waktu review approve).
CREATE INDEX `idx_contributions_status_created` ON `contributions` (`status`,`created_at`);
--> statement-breakpoint
CREATE INDEX `idx_contribution_reviews_reviewer_created` ON `contribution_reviews` (`reviewer_id`,`created_at`);
