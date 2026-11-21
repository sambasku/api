-- User yang dikecualikan dari agregat papan peringkat mingguan (#310).
CREATE TABLE `leaderboard_excluded_users` (
	`user_id` text PRIMARY KEY NOT NULL REFERENCES users(id),
	`note` text,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
INSERT OR IGNORE INTO `leaderboard_excluded_users` (`user_id`, `note`, `created_at`) VALUES
	('01ANONIM000000000000000000', 'Kontribusi anonim tanpa login', unixepoch()),
	('01CSVIMP000000000000000000', 'Pengimpor data CSV', unixepoch()),
	('01GHACTIONS000000000000000', 'Trigger GitHub Actions', unixepoch()),
	('01WEBIMP000000000000000000', 'Web Import publik', unixepoch()),
	('01VOTWAR000000000000000000', 'Auto-verifikasi Voting Warga', unixepoch());