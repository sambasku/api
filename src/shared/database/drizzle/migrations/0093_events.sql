-- Fitur Event/Acara Sambas (PRD event): katalog acara + relasi wisata +
-- usulan pengguna terpisah dari event resmi.
--
-- Struktur:
-- - `event_categories`  : kategori acara (console CRUD, pola place_categories).
-- - `events`            : event resmi. Status publikasi draft/published/archived;
--                         status pelaksanaan (upcoming/ongoing/completed/cancelled)
--                         TIDAK disimpan - diturunkan read-time dari starts_at,
--                         ends_at, cancelled_at (PRD 7.2: jangan redundan).
-- - `event_places`      : relasi banyak-ke-banyak event <-> places (wisata).
--                         FK dengan ON DELETE CASCADE supaya tidak yatim.
-- - `event_contributions`: usulan pengguna (bisa anonim). Terpisah dari events
--                         supaya usulan tidak pernah bocor ke API publik.
--                         Status moderasi 4 nilai (PRD 7.1, termasuk
--                         needs_revision untuk alur revisi pengusul).
--
-- `events.source_url` menyimpan link original konten (FB/IG/website) TANPA
-- UTM - sisipan utm_source=sambasku.com dilakukan saat render (rule
-- external-link-utm), bukan di data.
--
-- CHECK ends_at >= starts_at menjaga integritas jadwal di level DB.

CREATE TABLE `event_categories` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`status` text DEFAULT 'published' NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer,
	`deleted_at` integer
);
--> statement-breakpoint
CREATE INDEX `event_categories_status_idx` ON `event_categories` (`status`);
--> statement-breakpoint
CREATE INDEX `event_categories_sort_idx` ON `event_categories` (`sort_order`);
--> statement-breakpoint
CREATE TABLE `events` (
	`id` text PRIMARY KEY NOT NULL,
	`slug` text NOT NULL,
	`name` text NOT NULL,
	`description` text NOT NULL,
	`category_id` text NOT NULL,
	`starts_at` integer NOT NULL,
	`ends_at` integer NOT NULL,
	`location_text` text NOT NULL,
	`lat` real,
	`lng` real,
	`maps_url` text,
	`poster_url` text,
	`organizer` text,
	`source_url` text,
	`source_type` text,
	`source_attribution` text,
	`region_id` text,
	`village_id` text,
	`status` text DEFAULT 'draft' NOT NULL,
	`cancelled_at` integer,
	`published_at` integer,
	`author_id` text,
	`created_at` integer NOT NULL,
	`updated_at` integer,
	`deleted_at` integer,
	FOREIGN KEY (`category_id`) REFERENCES `event_categories`(`id`) ON UPDATE no action ON DELETE no action,
	CHECK (`events`.`ends_at` >= `events`.`starts_at`)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `events_slug_uidx` ON `events` (`slug`);
--> statement-breakpoint
CREATE INDEX `events_category_idx` ON `events` (`category_id`);
--> statement-breakpoint
CREATE INDEX `events_village_id_idx` ON `events` (`village_id`);
--> statement-breakpoint
CREATE INDEX `events_status_idx` ON `events` (`status`);
--> statement-breakpoint
CREATE INDEX `events_starts_at_idx` ON `events` (`starts_at`);
--> statement-breakpoint
CREATE INDEX `events_status_starts_at_idx` ON `events` (`status`,`starts_at`);
--> statement-breakpoint
CREATE TABLE `event_places` (
	`event_id` text NOT NULL,
	`place_id` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`event_id`) REFERENCES `events`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`place_id`) REFERENCES `places`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `event_places_event_id_idx` ON `event_places` (`event_id`);
--> statement-breakpoint
CREATE INDEX `event_places_place_id_idx` ON `event_places` (`place_id`);
--> statement-breakpoint
CREATE TABLE `event_contributions` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`event_id` text,
	`payload_json` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`revision_note` text,
	`reject_reason_code` text,
	`reject_reason_text` text,
	`created_at` integer NOT NULL,
	`updated_at` integer,
	`reviewed_at` integer
);
--> statement-breakpoint
CREATE INDEX `event_contributions_user_status_idx` ON `event_contributions` (`user_id`,`status`);
--> statement-breakpoint
CREATE INDEX `event_contributions_status_created_idx` ON `event_contributions` (`status`,`created_at`);
--> statement-breakpoint
CREATE INDEX `event_contributions_event_id_idx` ON `event_contributions` (`event_id`);
--> statement-breakpoint
-- Kategori awal PRD event sec. 6.4 (pola seed 0076_place_categories).
INSERT OR IGNORE INTO `event_categories` (`id`, `name`, `sort_order`, `status`, `created_at`) VALUES
('budaya-tradisi', 'Budaya dan Tradisi', 0, 'published', unixepoch()),
('festival-hiburan', 'Festival dan Hiburan', 1, 'published', unixepoch()),
('pariwisata', 'Pariwisata', 2, 'published', unixepoch()),
('olahraga', 'Olahraga', 3, 'published', unixepoch()),
('pendidikan', 'Pendidikan', 4, 'published', unixepoch()),
('keagamaan', 'Keagamaan', 5, 'published', unixepoch()),
('umkm', 'UMKM dan Ekonomi Kreatif', 6, 'published', unixepoch()),
('sosial', 'Sosial dan Kemasyarakatan', 7, 'published', unixepoch()),
('lainnya', 'Lainnya', 8, 'published', unixepoch());
