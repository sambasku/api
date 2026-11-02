-- Fitur Kuliner SambasKu (PRD kuliner): dokumentasi makanan/minuman +
-- tempat/penjual yang menyediakannya, lewat kontribusi komunitas termoderasi.
--
-- Struktur (pola 0097_usaha):
-- - `culinary_categories`     : katalog kategori kuliner (console CRUD).
-- - `cuisines`                : entitas makanan/minuman. Status publikasi
--                               terpisah dari data dokumentasi opsional.
-- - `culinary_places`         : entitas tempat/penjual (restoran, warung,
--                               pedagang pasar, penjual keliling). Status
--                               operasional DIPISAH dari status publikasi.
-- - `culinary_place_cuisines` : relasi many-to-many + status ketersediaan.
--                               FK ON DELETE restrict: hapus relasi tidak
--                               pernah menghapus entitas (PRD 6.3).
-- - `culinary_contributions`  : SEMUA usulan/perubahan (kind discriminator).
-- - `culinary_claims`         : klaim pengelolaan tempat (bukti PRIVAT).
-- - `culinary_reports`        : laporan data salah (target polimorfik).
--
-- Field-lock (pola usaha, PRD 14): `locked_fields` kanonik ter-sort per
-- pengajuan; overlap dicek use-case (409) supaya dua admin tidak menimpa
-- bidang yang sama.

CREATE TABLE `culinary_categories` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`status` text DEFAULT 'published' NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer,
	`deleted_at` integer
);
--> statement-breakpoint
CREATE INDEX `culinary_categories_status_idx` ON `culinary_categories` (`status`);
--> statement-breakpoint
CREATE INDEX `culinary_categories_sort_idx` ON `culinary_categories` (`sort_order`);
--> statement-breakpoint
CREATE TABLE `cuisines` (
	`id` text PRIMARY KEY NOT NULL,
	`slug` text NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`category_id` text,
	`origin_region` text,
	`images_json` text,
	`ingredients_json` text,
	`serving_suggestion` text,
	`tags_json` text,
	`sources_json` text,
	`license` text,
	`publish_status` text DEFAULT 'published' NOT NULL,
	`restricted_reason` text,
	`restricted_at` integer,
	`author_id` text,
	`published_at` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer,
	`deleted_at` integer,
	FOREIGN KEY (`category_id`) REFERENCES `culinary_categories`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `cuisines_slug_uidx` ON `cuisines` (`slug`);
--> statement-breakpoint
CREATE INDEX `cuisines_publish_status_idx` ON `cuisines` (`publish_status`);
--> statement-breakpoint
CREATE INDEX `cuisines_status_category_idx` ON `cuisines` (`publish_status`,`category_id`);
--> statement-breakpoint
CREATE INDEX `cuisines_name_idx` ON `cuisines` (`name`);
--> statement-breakpoint
CREATE TABLE `culinary_places` (
	`id` text PRIMARY KEY NOT NULL,
	`slug` text NOT NULL,
	`name` text NOT NULL,
	`type` text,
	`description` text,
	`location_hint` text,
	`address_text` text,
	`lat` real,
	`lng` real,
	`maps_url` text,
	`phone` text,
	`whatsapp` text,
	`website` text,
	`social_url` text,
	`cover_url` text,
	`operational_status` text DEFAULT 'unknown' NOT NULL,
	`publish_status` text DEFAULT 'published' NOT NULL,
	`restricted_reason` text,
	`restricted_at` integer,
	`manager_id` text,
	`author_id` text,
	`published_at` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer,
	`deleted_at` integer
);
--> statement-breakpoint
CREATE UNIQUE INDEX `culinary_places_slug_uidx` ON `culinary_places` (`slug`);
--> statement-breakpoint
CREATE INDEX `culinary_places_publish_status_idx` ON `culinary_places` (`publish_status`);
--> statement-breakpoint
CREATE INDEX `culinary_places_type_status_idx` ON `culinary_places` (`type`,`publish_status`);
--> statement-breakpoint
CREATE INDEX `culinary_places_manager_id_idx` ON `culinary_places` (`manager_id`);
--> statement-breakpoint
CREATE INDEX `culinary_places_name_idx` ON `culinary_places` (`name`);
--> statement-breakpoint
CREATE TABLE `culinary_place_cuisines` (
	`id` text PRIMARY KEY NOT NULL,
	`cuisine_id` text NOT NULL,
	`place_id` text NOT NULL,
	`availability` text DEFAULT 'unknown' NOT NULL,
	`note` text,
	`publish_status` text DEFAULT 'published' NOT NULL,
	`author_id` text,
	`created_at` integer NOT NULL,
	`updated_at` integer,
	`deleted_at` integer,
	FOREIGN KEY (`cuisine_id`) REFERENCES `cuisines`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`place_id`) REFERENCES `culinary_places`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE INDEX `culinary_place_cuisines_cuisine_idx` ON `culinary_place_cuisines` (`cuisine_id`,`publish_status`);
--> statement-breakpoint
CREATE INDEX `culinary_place_cuisines_place_idx` ON `culinary_place_cuisines` (`place_id`,`publish_status`);
--> statement-breakpoint
CREATE UNIQUE INDEX `culinary_place_cuisines_pair_uidx` ON `culinary_place_cuisines` (`cuisine_id`,`place_id`) WHERE `culinary_place_cuisines`.`deleted_at` IS NULL;
--> statement-breakpoint
CREATE TABLE `culinary_contributions` (
	`id` text PRIMARY KEY NOT NULL,
	`kind` text NOT NULL,
	`user_id` text NOT NULL,
	`cuisine_id` text,
	`place_id` text,
	`link_id` text,
	`locked_fields` text DEFAULT '' NOT NULL,
	`payload_json` text NOT NULL,
	`base_updated_at` integer,
	`status` text DEFAULT 'pending' NOT NULL,
	`result_cuisine_id` text,
	`result_place_id` text,
	`revision_note` text,
	`reject_reason_code` text,
	`reject_reason_text` text,
	`created_at` integer NOT NULL,
	`updated_at` integer,
	`reviewed_at` integer
);
--> statement-breakpoint
CREATE INDEX `culinary_contributions_user_status_idx` ON `culinary_contributions` (`user_id`,`status`);
--> statement-breakpoint
CREATE INDEX `culinary_contributions_status_created_idx` ON `culinary_contributions` (`status`,`created_at`);
--> statement-breakpoint
CREATE INDEX `culinary_contributions_cuisine_idx` ON `culinary_contributions` (`cuisine_id`,`status`);
--> statement-breakpoint
CREATE INDEX `culinary_contributions_place_idx` ON `culinary_contributions` (`place_id`,`status`);
--> statement-breakpoint
CREATE INDEX `culinary_contributions_kind_status_idx` ON `culinary_contributions` (`kind`,`status`);
--> statement-breakpoint
CREATE TABLE `culinary_claims` (
	`id` text PRIMARY KEY NOT NULL,
	`place_id` text NOT NULL,
	`user_id` text NOT NULL,
	`contact_evidence` text NOT NULL,
	`note` text,
	`status` text DEFAULT 'pending' NOT NULL,
	`reject_reason_code` text,
	`reject_reason_text` text,
	`reviewed_by` text,
	`reviewed_at` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer
);
--> statement-breakpoint
CREATE INDEX `culinary_claims_place_status_idx` ON `culinary_claims` (`place_id`,`status`);
--> statement-breakpoint
CREATE INDEX `culinary_claims_user_idx` ON `culinary_claims` (`user_id`,`status`);
--> statement-breakpoint
CREATE UNIQUE INDEX `culinary_claims_pending_user_uidx` ON `culinary_claims` (`place_id`,`user_id`) WHERE `culinary_claims`.`status` = 'pending';
--> statement-breakpoint
CREATE TABLE `culinary_reports` (
	`id` text PRIMARY KEY NOT NULL,
	`target_type` text NOT NULL,
	`target_id` text NOT NULL,
	`user_id` text NOT NULL,
	`reason_code` text NOT NULL,
	`note` text,
	`status` text DEFAULT 'open' NOT NULL,
	`resolution` text,
	`resolution_note` text,
	`resolved_by` text,
	`resolved_at` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer
);
--> statement-breakpoint
CREATE INDEX `culinary_reports_status_id_idx` ON `culinary_reports` (`status`,`id`);
--> statement-breakpoint
CREATE INDEX `culinary_reports_target_idx` ON `culinary_reports` (`target_type`,`target_id`,`status`);
--> statement-breakpoint
CREATE UNIQUE INDEX `culinary_reports_open_user_uidx` ON `culinary_reports` (`target_type`,`target_id`,`user_id`) WHERE `culinary_reports`.`status` = 'open';
--> statement-breakpoint
-- Seed kategori awal (pola 0097 usaha_categories). Kategori bukan syarat
-- usulan - hanya alat penelusuran.
INSERT OR IGNORE INTO `culinary_categories` (`id`, `name`, `sort_order`, `status`, `created_at`) VALUES
('makanan-utama', 'Makanan Utama', 0, 'published', unixepoch()),
('camilan', 'Camilan', 1, 'published', unixepoch()),
('minuman', 'Minuman', 2, 'published', unixepoch()),
('jajanan-pasar', 'Jajanan Pasar', 3, 'published', unixepoch()),
('kue-tradisional', 'Kue Tradisional', 4, 'published', unixepoch()),
('lainnya', 'Lainnya', 5, 'published', unixepoch());
