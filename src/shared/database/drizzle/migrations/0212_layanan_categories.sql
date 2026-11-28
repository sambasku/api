-- Migration 0212: master kategori layanan publik (pengganti enum hardcoded ambulance/fire).
-- `id` = slug, dipakai sebagai nilai `layanans.category`. Slug tidak boleh diubah.
-- `short_label` dipakai chip filter dan label tabel; harus unik di antara kategori hidup.
-- `status` archived: layanan lama tetap tampil publik, tapi kategori tidak bisa dipilih untuk input baru.
-- PMI di-seed `archived` sampai klien mobile/web baru rilis (klien lama salah label untuk PMI).
-- Aktifkan lewat console `/layanan/kategori` setelah rilis.
-- Tidak ada rebuild `layanans`: kolom category sudah text, validasi dilakukan di app terhadap master.

CREATE TABLE `layanan_categories` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`short_label` text NOT NULL,
	`icon` text DEFAULT 'siren' NOT NULL,
	`status` text DEFAULT 'published' NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer,
	`deleted_at` integer,
	CONSTRAINT `layanan_categories_status_chk` CHECK (`status` IN ('published', 'archived'))
);
--> statement-breakpoint
CREATE INDEX `layanan_categories_status_idx` ON `layanan_categories` (`status`);
--> statement-breakpoint
CREATE INDEX `layanan_categories_sort_idx` ON `layanan_categories` (`sort_order`);
--> statement-breakpoint
CREATE UNIQUE INDEX `layanan_categories_short_label_uq` ON `layanan_categories` (`short_label`) WHERE `deleted_at` IS NULL;
--> statement-breakpoint
-- Seed awal: nilai yang sudah dipakai layanans sejak 0123 + PMI (#409).
INSERT OR IGNORE INTO `layanan_categories` (`id`, `name`, `short_label`, `icon`, `status`, `sort_order`, `created_at`) VALUES
('ambulance', 'Ambulan', 'Ambulan', 'ambulance', 'published', 0, unixepoch()),
('fire', 'Pemadam kebakaran', 'Damkar', 'flame', 'published', 1, unixepoch()),
('pmi', 'Palang Merah Indonesia', 'PMI', 'cross', 'archived', 2, unixepoch());
