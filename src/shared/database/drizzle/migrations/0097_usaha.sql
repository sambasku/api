-- Fitur Usaha SambasKu (PRD Usaha): direktori usaha & jasa lokal +
-- usulan pengguna + klaim pengelolaan + katalog + laporan masyarakat.
--
-- Struktur (pola 0093_events):
-- - `usaha_categories`   : katalog kategori (console CRUD, pola place_categories).
-- - `usahas`             : entitas publik. Status DIPISAH per dimensi (PRD 11):
--                          publish_status (draft/published/archived/restricted) vs
--                          operational_status (unknown/open/temporarily_closed/
--                          permanently_closed) vs klaim (usaha_claims) vs perubahan
--                          (usaha_contributions). Jangan gabung satu status.
-- - `usaha_items`        : katalog produk/jasa opsional (PRD 6.3). Bukan inventaris;
--                          price_text kosong = harga belum dicantumkan (bukan gratis).
-- - `usaha_contributions`: SEMUA pengajuan (kind discriminator): usulan baru +
--                          pengajuan pengelola (profile/item_*/operational/archive/
--                          restore). Terpisah supaya data publik hanya versi approved.
-- - `usaha_claims`       : klaim pengelolaan (wajib login, review admin).
--                          contact_evidence PRIVAT - tidak pernah di endpoint publik.
-- - `usaha_reports`      : laporan masyarakat (pola word_reports). Tidak otomatis
--                          mengubah status apa pun.
--
-- Field-lock (PRD 10.1): `locked_fields` kanonik ter-sort per pengajuan;
-- overlap check dilakukan use-case (query IN), bidang berbeda bebas diajukan.

CREATE TABLE `usaha_categories` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`status` text DEFAULT 'published' NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer,
	`deleted_at` integer
);
--> statement-breakpoint
CREATE INDEX `usaha_categories_status_idx` ON `usaha_categories` (`status`);
--> statement-breakpoint
CREATE INDEX `usaha_categories_sort_idx` ON `usaha_categories` (`sort_order`);
--> statement-breakpoint
CREATE TABLE `usahas` (
	`id` text PRIMARY KEY NOT NULL,
	`slug` text NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`category_id` text,
	`kind` text DEFAULT 'product' NOT NULL,
	`region_id` text,
	`village_id` text,
	`address_text` text,
	`lat` real,
	`lng` real,
	`maps_url` text,
	`phone` text,
	`whatsapp` text,
	`website` text,
	`social_url` text,
	`cover_url` text,
	`publish_status` text DEFAULT 'draft' NOT NULL,
	`operational_status` text DEFAULT 'unknown' NOT NULL,
	`restricted_reason` text,
	`restricted_at` integer,
	`manager_id` text,
	`author_id` text,
	`published_at` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer,
	`deleted_at` integer,
	FOREIGN KEY (`category_id`) REFERENCES `usaha_categories`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `usahas_slug_uidx` ON `usahas` (`slug`);
--> statement-breakpoint
CREATE INDEX `usahas_publish_status_idx` ON `usahas` (`publish_status`);
--> statement-breakpoint
CREATE INDEX `usahas_status_category_idx` ON `usahas` (`publish_status`,`category_id`);
--> statement-breakpoint
CREATE INDEX `usahas_region_id_idx` ON `usahas` (`region_id`);
--> statement-breakpoint
CREATE INDEX `usahas_village_id_idx` ON `usahas` (`village_id`);
--> statement-breakpoint
CREATE INDEX `usahas_manager_id_idx` ON `usahas` (`manager_id`);
--> statement-breakpoint
CREATE INDEX `usahas_status_updated_at_idx` ON `usahas` (`publish_status`,`updated_at`);
--> statement-breakpoint
CREATE TABLE `usaha_items` (
	`id` text PRIMARY KEY NOT NULL,
	`usaha_id` text NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`price_text` text,
	`image_url` text,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer,
	FOREIGN KEY (`usaha_id`) REFERENCES `usahas`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `usaha_items_usaha_status_idx` ON `usaha_items` (`usaha_id`,`status`,`sort_order`);
--> statement-breakpoint
CREATE TABLE `usaha_contributions` (
	`id` text PRIMARY KEY NOT NULL,
	`kind` text NOT NULL,
	`user_id` text NOT NULL,
	`usaha_id` text,
	`item_id` text,
	`locked_fields` text DEFAULT '' NOT NULL,
	`payload_json` text NOT NULL,
	`base_updated_at` integer,
	`status` text DEFAULT 'pending' NOT NULL,
	`wants_claim` integer DEFAULT false NOT NULL,
	`result_usaha_id` text,
	`revision_note` text,
	`reject_reason_code` text,
	`reject_reason_text` text,
	`created_at` integer NOT NULL,
	`updated_at` integer,
	`reviewed_at` integer
);
--> statement-breakpoint
CREATE INDEX `usaha_contributions_user_status_idx` ON `usaha_contributions` (`user_id`,`status`);
--> statement-breakpoint
CREATE INDEX `usaha_contributions_status_created_idx` ON `usaha_contributions` (`status`,`created_at`);
--> statement-breakpoint
CREATE INDEX `usaha_contributions_usaha_idx` ON `usaha_contributions` (`usaha_id`,`status`);
--> statement-breakpoint
CREATE INDEX `usaha_contributions_kind_status_idx` ON `usaha_contributions` (`kind`,`status`);
--> statement-breakpoint
CREATE TABLE `usaha_claims` (
	`id` text PRIMARY KEY NOT NULL,
	`usaha_id` text NOT NULL,
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
CREATE INDEX `usaha_claims_usaha_status_idx` ON `usaha_claims` (`usaha_id`,`status`);
--> statement-breakpoint
CREATE INDEX `usaha_claims_user_idx` ON `usaha_claims` (`user_id`,`status`);
--> statement-breakpoint
CREATE UNIQUE INDEX `usaha_claims_pending_user_uidx` ON `usaha_claims` (`usaha_id`,`user_id`) WHERE `usaha_claims`.`status` = 'pending';
--> statement-breakpoint
CREATE TABLE `usaha_reports` (
	`id` text PRIMARY KEY NOT NULL,
	`usaha_id` text NOT NULL,
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
CREATE INDEX `usaha_reports_status_id_idx` ON `usaha_reports` (`status`,`id`);
--> statement-breakpoint
CREATE INDEX `usaha_reports_usaha_idx` ON `usaha_reports` (`usaha_id`,`status`);
--> statement-breakpoint
CREATE UNIQUE INDEX `usaha_reports_open_user_uidx` ON `usaha_reports` (`usaha_id`,`user_id`) WHERE `usaha_reports`.`status` = 'open';
--> statement-breakpoint
-- Seed kategori awal (pola 0093 event_categories).
INSERT OR IGNORE INTO `usaha_categories` (`id`, `name`, `sort_order`, `status`, `created_at`) VALUES
('kuliner', 'Kuliner', 0, 'published', unixepoch()),
('jasa', 'Jasa', 1, 'published', unixepoch()),
('toko-kelontong', 'Toko dan Kelontong', 2, 'published', unixepoch()),
('pertanian', 'Pertanian', 3, 'published', unixepoch()),
('perikanan', 'Perikanan', 4, 'published', unixepoch()),
('kerajinan', 'Kerajinan', 5, 'published', unixepoch()),
('jasa-otomotif', 'Jasa Otomotif', 6, 'published', unixepoch()),
('laundry', 'Laundry', 7, 'published', unixepoch()),
('lainnya', 'Lainnya', 8, 'published', unixepoch());
