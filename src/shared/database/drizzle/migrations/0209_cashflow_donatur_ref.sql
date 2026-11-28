-- Donatur/sponsor terhubung ke user (perorangan) atau usaha. Referensi lunak tanpa FK:
-- ledger append-only, jadi FK restrict memblokir hapus akun/usaha dan SET NULL ditolak trigger.
-- Nama tetap disimpan sebagai snapshot di donatur_nama.
ALTER TABLE `cash_transactions` ADD `donatur_tipe` text CONSTRAINT `cash_tx_donatur_tipe_chk` CHECK (`donatur_tipe` IS NULL OR `donatur_tipe` IN ('perorangan', 'usaha'));--> statement-breakpoint
ALTER TABLE `cash_transactions` ADD `donatur_user_id` text;--> statement-breakpoint
ALTER TABLE `cash_transactions` ADD `donatur_usaha_id` text;--> statement-breakpoint
-- Konsistensi: usaha butuh usaha_id tanpa user_id, perorangan tanpa usaha_id, anonim tanpa keduanya.
CREATE TRIGGER `cash_tx_donatur_ref_guard` BEFORE INSERT ON `cash_transactions` FOR EACH ROW WHEN (NEW.`donatur_tipe` = 'usaha' AND (NEW.`donatur_usaha_id` IS NULL OR NEW.`donatur_user_id` IS NOT NULL)) OR (NEW.`donatur_tipe` = 'perorangan' AND NEW.`donatur_usaha_id` IS NOT NULL) OR (NEW.`donatur_tipe` IS NULL AND (NEW.`donatur_user_id` IS NOT NULL OR NEW.`donatur_usaha_id` IS NOT NULL)) BEGIN SELECT RAISE(ABORT, 'DONATUR_TIDAK_VALID'); END;
