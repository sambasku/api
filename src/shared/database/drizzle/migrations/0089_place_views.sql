-- Counter view detail place per hari WIB (place_views). Sumber metrik
-- "wisata terpopuler" console: kolom Dilihat di /places + halaman
-- /places/views (KPI, tren harian, tabel per-place).
-- Upsert dari POST /api/v1/places/:slug/view (web + mobile).
CREATE TABLE `place_views` (
	`place_id` text NOT NULL,
	`day` text NOT NULL,
	`count` integer NOT NULL DEFAULT 0,
	FOREIGN KEY (`place_id`) REFERENCES `places`(`id`) ON UPDATE no action ON DELETE no action,
	PRIMARY KEY (`place_id`, `day`)
);
--> statement-breakpoint
CREATE INDEX `place_views_day_idx` ON `place_views` (`day`);
