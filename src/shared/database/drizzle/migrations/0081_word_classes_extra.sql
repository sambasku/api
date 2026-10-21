-- Tambah kelas kata yang belum ada: antonim, cakapan, kiasan, dsb.
-- Kode `adj` dan `part` sengaja dipertahankan (jangan rename).
-- OR IGNORE: aman dijalankan ulang / kalau baris sudah ada.
INSERT OR IGNORE INTO `word_classes` (`id`, `code`, `name`, `alias`, `description`, `created_at`) VALUES ('01M5CQMCB2FJQ2RMJ8X4HVWP4K', 'ant', 'Antonim', 'Kata Lawan', 'antonym - kata berlawanan makna (panas - dingin)', unixepoch());
--> statement-breakpoint
INSERT OR IGNORE INTO `word_classes` (`id`, `code`, `name`, `alias`, `description`, `created_at`) VALUES ('01M5CQMCB4V2CZW8MF94CASJWG', 'cak', 'Cakapan', 'Kata Sehari-hari', 'colloquial - gaya tutur tidak baku, khas percakapan sehari-hari', unixepoch());
--> statement-breakpoint
INSERT OR IGNORE INTO `word_classes` (`id`, `code`, `name`, `alias`, `description`, `created_at`) VALUES ('01M5CQMCB4HQTXM6ZNJRBYS7YJ', 'ki', 'Kiasan', 'Makna Kias', 'figurative - makna tidak sebenarnya, kiasan atau majas', unixepoch());
--> statement-breakpoint
INSERT OR IGNORE INTO `word_classes` (`id`, `code`, `name`, `alias`, `description`, `created_at`) VALUES ('01M5CQMCB57KPH16FF82BVK152', 'dsb', 'Dan Sebagainya', 'Dsb.', 'dsb. - penanda kelanjutan daftar, kategori lanjutan, atau keterangan berikutnya', unixepoch());
