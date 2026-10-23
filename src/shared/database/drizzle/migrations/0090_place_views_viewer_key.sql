-- Dedupe view place per pembaca (docs/api/45-api-place-views.md).
--
-- Sebelumnya PK (place_id, day) dengan kolom count = jumlah pembukaan, jadi
-- 1 orang refresh 10x = 10 view. Sekarang PK jadi (place_id, day,
-- viewer_key): 1 baris per pembaca per hari, insert idempotent
-- (ON CONFLICT DO NOTHING). Angka di console = jumlah pembaca unik.
--
-- Baris lama (0089) sudah teragregasi tanpa info identitas, jadi
-- backfill dengan viewer_key = 'legacy' - 1 baris per (place, day) dengan
-- count lama. Setelah 30 hari, 'legacy' keluar dari rentang default.
CREATE TABLE `place_views_new` (
	`place_id` text NOT NULL,
	`day` text NOT NULL,
	`viewer_key` text NOT NULL,
	`count` integer NOT NULL DEFAULT 1,
	FOREIGN KEY (`place_id`) REFERENCES `places`(`id`) ON UPDATE no action ON DELETE no action,
	PRIMARY KEY (`place_id`, `day`, `viewer_key`)
);
--> statement-breakpoint
INSERT INTO `place_views_new` (`place_id`, `day`, `viewer_key`, `count`)
SELECT `place_id`, `day`, 'legacy', `count` FROM `place_views`;
--> statement-breakpoint
DROP TABLE `place_views`;
--> statement-breakpoint
ALTER TABLE `place_views_new` RENAME TO `place_views`;
--> statement-breakpoint
CREATE INDEX `place_views_day_idx` ON `place_views` (`day`);
