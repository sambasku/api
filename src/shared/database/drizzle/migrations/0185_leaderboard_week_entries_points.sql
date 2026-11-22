-- Skor papan peringkat jadi poin (plan peringkat mingguan skor poin usul + bonus):
-- contributions (jumlah kejadian) -> submitted_points (usulan x5/x3),
-- verifications -> approved_points (bonus approve x2), baru verification_points (keputusan x2).
ALTER TABLE leaderboard_week_entries RENAME COLUMN contributions TO submitted_points;--> statement-breakpoint
ALTER TABLE leaderboard_week_entries RENAME COLUMN verifications TO approved_points;--> statement-breakpoint
ALTER TABLE leaderboard_week_entries ADD COLUMN verification_points integer NOT NULL DEFAULT 0;
