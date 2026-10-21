-- Sistem achievement (Pencapaian): katalog reward + fakta penganugerahan.
--
-- Satu katalog untuk semua jenis reward (profile_border | badge | sticker)
-- dan satu tabel kepemilikan (user_achievements). Tidak ada tabel master
-- terpisah per jenis reward: jenis dibaca dari achievements.reward_type.
--
-- Border profil yang SEDANG dipakai disimpan di users.active_border_id
-- (FK ke user_achievements.id) supaya sinkron lintas perangkat; kepemilikan
-- tetap ditentukan oleh user_achievements.
--
-- Idempotensi: UNIQUE (achievement_id, user_id) - scan/grant berulang aman.
CREATE TABLE `achievements` (
`id` text PRIMARY KEY NOT NULL,
`code` text NOT NULL,
`title` text NOT NULL,
`description` text NOT NULL,
`category` text NOT NULL,
`reward_type` text NOT NULL,
`badge_url` text,
`criteria` text NOT NULL,
`family` text,
`level` integer,
`is_active` integer DEFAULT 1 NOT NULL,
`created_at` integer NOT NULL,
`updated_at` integer,
`deleted_at` integer,
`deleted_by` text REFERENCES users(id)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `achievements_code_unique` ON `achievements` (`code`);
--> statement-breakpoint
CREATE INDEX `achievements_active_idx` ON `achievements` (`is_active`);
--> statement-breakpoint
CREATE INDEX `achievements_reward_type_idx` ON `achievements` (`reward_type`);
--> statement-breakpoint
CREATE TABLE `user_achievements` (
`id` text PRIMARY KEY NOT NULL,
`achievement_id` text NOT NULL REFERENCES achievements(id),
`user_id` text NOT NULL REFERENCES users(id),
`awarded_at` integer NOT NULL,
`granted_via` text NOT NULL,
`context` text,
`created_at` integer NOT NULL,
`deleted_at` integer,
`deleted_by` text REFERENCES users(id)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `user_achievements_unique` ON `user_achievements` (`achievement_id`,`user_id`);
--> statement-breakpoint
CREATE INDEX `user_achievements_user_idx` ON `user_achievements` (`user_id`);
--> statement-breakpoint
CREATE INDEX `user_achievements_achievement_idx` ON `user_achievements` (`achievement_id`);
--> statement-breakpoint
-- FK border aktif -> user_achievements.id. Drizzle tidak bisa deklarasi kolom
-- ini (siklus import users <-> user_achievements), jadi dibuat manual di SQL:
-- DB menolak memakai border yang tidak dimiliki.
ALTER TABLE `users` ADD COLUMN `active_border_id` text REFERENCES user_achievements(id);
--> statement-breakpoint
CREATE INDEX `users_active_border_idx` ON `users` (`active_border_id`);
