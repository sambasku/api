-- Modul cashflow sederhana (admin): master kategori, rekening, kewajiban berulang,
-- ledger append-only, talangan + reimburse, refund, dan rekonsiliasi.
--
-- Guard uang dijaga TRIGGER di sini (bukan hanya di aplikasi), supaya dua request
-- paralel tidak bisa membuat kas minus atau reimburse melebihi pokok:
--   KAS_TIDAK_CUKUP        - pengeluaran/refund/transfer keluar melebihi saldo rekening
--   REIMBURSE_MELEBIHI_SISA - reimburse melebihi sisa pokok loan
--   REFUND_MELEBIHI_DONASI  - refund melebihi nominal donasi asal
--   LOAN_TIDAK_AKTIF        - reimburse ke loan yang dihibahkan atau dibatalkan
--   APPEND_ONLY             - UPDATE/DELETE pada ledger ditolak
-- Penulisan transaksi selalu lewat db.transaction (mode write = kunci di awal).

CREATE TABLE `kategori_transaksi` (
	`id` text PRIMARY KEY NOT NULL,
	`kode` text NOT NULL,
	`nama` text NOT NULL,
	`tipe` text NOT NULL,
	`aktif` integer DEFAULT true NOT NULL,
	`created_at` integer NOT NULL,
	CONSTRAINT `kategori_transaksi_tipe_chk` CHECK (`tipe` IN ('masuk', 'keluar'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `kategori_transaksi_kode_uidx` ON `kategori_transaksi` (`kode`);
--> statement-breakpoint
CREATE TABLE `rekening` (
	`id` text PRIMARY KEY NOT NULL,
	`nama` text NOT NULL,
	`jenis` text NOT NULL,
	`saldo_awal` integer DEFAULT 0 NOT NULL,
	`aktif` integer DEFAULT true NOT NULL,
	`created_at` integer NOT NULL,
	CONSTRAINT `rekening_jenis_chk` CHECK (`jenis` IN ('bank', 'tunai', 'dompet'))
);
--> statement-breakpoint
CREATE TABLE `rekonsiliasi` (
	`id` text PRIMARY KEY NOT NULL,
	`rekening_id` text NOT NULL,
	`tanggal` text NOT NULL,
	`saldo_bank` integer NOT NULL,
	`saldo_ledger` integer NOT NULL,
	`selisih` integer NOT NULL,
	`catatan` text DEFAULT '' NOT NULL,
	`created_by` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`rekening_id`) REFERENCES `rekening`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE TABLE `kewajiban` (
	`id` text PRIMARY KEY NOT NULL,
	`nama` text NOT NULL,
	`nominal_estimasi` integer NOT NULL,
	`kategori_id` text NOT NULL,
	`recurrence` text NOT NULL,
	`periode_mulai` text NOT NULL,
	`hari_jatuh_tempo` integer NOT NULL,
	`aktif` integer DEFAULT true NOT NULL,
	`berhenti_per` text,
	`created_by` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`kategori_id`) REFERENCES `kategori_transaksi`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null,
	CONSTRAINT `kewajiban_nominal_chk` CHECK (`nominal_estimasi` > 0),
	CONSTRAINT `kewajiban_recurrence_chk` CHECK (`recurrence` IN ('sekali', 'bulanan', 'tahunan')),
	CONSTRAINT `kewajiban_hari_chk` CHECK (`hari_jatuh_tempo` BETWEEN 1 AND 31)
);
--> statement-breakpoint
CREATE TABLE `loans` (
	`id` text PRIMARY KEY NOT NULL,
	`penalang_user_id` text,
	`penalang_nama` text NOT NULL,
	`pokok` integer NOT NULL,
	`pengeluaran_tx_id` text NOT NULL,
	`tanggal_talangan` text NOT NULL,
	`dihibahkan_at` integer,
	`catatan_hibah` text,
	`dibatalkan_at` integer,
	`version` integer DEFAULT 0 NOT NULL,
	`created_by` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`penalang_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`pengeluaran_tx_id`) REFERENCES `cash_transactions`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null,
	CONSTRAINT `loans_pokok_chk` CHECK (`pokok` > 0)
);
--> statement-breakpoint
CREATE INDEX `loans_pengeluaran_idx` ON `loans` (`pengeluaran_tx_id`);
--> statement-breakpoint
CREATE TABLE `cash_transactions` (
	`id` text PRIMARY KEY NOT NULL,
	`tipe` text NOT NULL,
	`kategori_id` text,
	`kategori_sistem` text,
	`nominal` integer NOT NULL,
	`tanggal` text NOT NULL,
	`catatan` text DEFAULT '' NOT NULL,
	`rekening_id` text NOT NULL,
	`loan_id` text,
	`kewajiban_id` text,
	`periode` text,
	`dibatalkan_dari_id` text,
	`alasan_koreksi` text,
	`refund_dari_id` text,
	`transfer_pair_id` text,
	`penerima_nama` text,
	`penerima_user_id` text,
	`bukti_url` text,
	`pajak_dipotong` integer,
	`donatur_nama` text,
	`tampil_publik` integer DEFAULT false NOT NULL,
	`idempotency_key` text,
	`created_by` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`kategori_id`) REFERENCES `kategori_transaksi`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`rekening_id`) REFERENCES `rekening`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`loan_id`) REFERENCES `loans`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`kewajiban_id`) REFERENCES `kewajiban`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`dibatalkan_dari_id`) REFERENCES `cash_transactions`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`refund_dari_id`) REFERENCES `cash_transactions`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`penerima_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT `cash_tx_tipe_chk` CHECK (`tipe` IN ('masuk', 'keluar')),
	CONSTRAINT `cash_tx_nominal_chk` CHECK (`nominal` > 0),
	CONSTRAINT `cash_tx_sistem_chk` CHECK (`kategori_sistem` IS NULL OR `kategori_sistem` IN ('talangan', 'reimburse', 'refund', 'reversal', 'transfer')),
	CONSTRAINT `cash_tx_kategori_xor_chk` CHECK ((`kategori_id` IS NULL) <> (`kategori_sistem` IS NULL)),
	CONSTRAINT `cash_tx_pajak_chk` CHECK (`pajak_dipotong` IS NULL OR `pajak_dipotong` >= 0),
	CONSTRAINT `cash_tx_publik_nama_chk` CHECK (`tampil_publik` = 0 OR `donatur_nama` IS NOT NULL)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `cash_tx_dibatalkan_dari_uidx` ON `cash_transactions` (`dibatalkan_dari_id`) WHERE `dibatalkan_dari_id` IS NOT NULL;
--> statement-breakpoint
CREATE UNIQUE INDEX `cash_tx_idempotency_uidx` ON `cash_transactions` (`idempotency_key`) WHERE `idempotency_key` IS NOT NULL;
--> statement-breakpoint
CREATE INDEX `cash_tx_rekening_idx` ON `cash_transactions` (`rekening_id`);
--> statement-breakpoint
CREATE INDEX `cash_tx_loan_idx` ON `cash_transactions` (`loan_id`);
--> statement-breakpoint
CREATE INDEX `cash_tx_kewajiban_periode_idx` ON `cash_transactions` (`kewajiban_id`, `periode`);
--> statement-breakpoint
CREATE INDEX `cash_tx_refund_dari_idx` ON `cash_transactions` (`refund_dari_id`);
--> statement-breakpoint
CREATE INDEX `cash_tx_tanggal_idx` ON `cash_transactions` (`tanggal`);
--> statement-breakpoint
CREATE TRIGGER `cash_tx_append_only_update`
BEFORE UPDATE ON `cash_transactions`
FOR EACH ROW
BEGIN
  SELECT RAISE(ABORT, 'APPEND_ONLY');
END;
--> statement-breakpoint
CREATE TRIGGER `cash_tx_append_only_delete`
BEFORE DELETE ON `cash_transactions`
FOR EACH ROW
BEGIN
  SELECT RAISE(ABORT, 'APPEND_ONLY');
END;
--> statement-breakpoint
CREATE TRIGGER `loans_append_only_delete`
BEFORE DELETE ON `loans`
FOR EACH ROW
BEGIN
  SELECT RAISE(ABORT, 'APPEND_ONLY');
END;
--> statement-breakpoint
-- Kas rekening tidak boleh minus setelah setiap pengeluaran (termasuk reversal masuk).
CREATE TRIGGER `cash_tx_kas_guard`
BEFORE INSERT ON `cash_transactions`
FOR EACH ROW
WHEN NEW.`tipe` = 'keluar' AND (
  (SELECT `saldo_awal` FROM `rekening` WHERE `id` = NEW.`rekening_id`)
  + COALESCE((SELECT SUM(CASE WHEN `tipe` = 'masuk' THEN `nominal` ELSE -`nominal` END)
              FROM `cash_transactions` WHERE `rekening_id` = NEW.`rekening_id`), 0)
  < NEW.`nominal`
)
BEGIN
  SELECT RAISE(ABORT, 'KAS_TIDAK_CUKUP');
END;
--> statement-breakpoint
-- Loan yang dihibahkan atau dibatalkan tidak boleh menerima reimburse.
CREATE TRIGGER `cash_tx_loan_aktif_guard`
BEFORE INSERT ON `cash_transactions`
FOR EACH ROW
WHEN NEW.`kategori_sistem` = 'reimburse' AND EXISTS (
  SELECT 1 FROM `loans` WHERE `id` = NEW.`loan_id`
    AND (`dihibahkan_at` IS NOT NULL OR `dibatalkan_at` IS NOT NULL)
)
BEGIN
  SELECT RAISE(ABORT, 'LOAN_TIDAK_AKTIF');
END;
--> statement-breakpoint
-- Sisa pokok = pokok - (reimburse - reversal reimburse). Reimburse baru tidak boleh melebihi sisa.
CREATE TRIGGER `cash_tx_reimburse_guard`
BEFORE INSERT ON `cash_transactions`
FOR EACH ROW
WHEN NEW.`kategori_sistem` = 'reimburse' AND (
  (SELECT `pokok` FROM `loans` WHERE `id` = NEW.`loan_id`)
  - COALESCE((SELECT SUM(CASE
                WHEN `kategori_sistem` = 'reimburse' THEN `nominal`
                WHEN `kategori_sistem` = 'reversal' AND `tipe` = 'masuk' THEN -`nominal`
                ELSE 0 END)
              FROM `cash_transactions` WHERE `loan_id` = NEW.`loan_id`), 0)
  < NEW.`nominal`
)
BEGIN
  SELECT RAISE(ABORT, 'REIMBURSE_MELEBIHI_SISA');
END;
--> statement-breakpoint
-- Refund total per donasi tidak boleh melebihi nominal donasi asal.
CREATE TRIGGER `cash_tx_refund_guard`
BEFORE INSERT ON `cash_transactions`
FOR EACH ROW
WHEN NEW.`kategori_sistem` = 'refund' AND (
  (SELECT `nominal` FROM `cash_transactions` WHERE `id` = NEW.`refund_dari_id`)
  - COALESCE((SELECT SUM(CASE
                WHEN `kategori_sistem` = 'refund' THEN `nominal`
                WHEN `kategori_sistem` = 'reversal' AND `tipe` = 'masuk' THEN -`nominal`
                ELSE 0 END)
              FROM `cash_transactions` WHERE `refund_dari_id` = NEW.`refund_dari_id`), 0)
  < NEW.`nominal`
)
BEGIN
  SELECT RAISE(ABORT, 'REFUND_MELEBIHI_DONASI');
END;
--> statement-breakpoint
-- Seed master kategori (asumsi awal, bisa diubah lewat console).
INSERT INTO `kategori_transaksi` (`id`, `kode`, `nama`, `tipe`, `aktif`, `created_at`) VALUES
  ('KTR-MSK-DON', 'MSK-DON', 'Donasi', 'masuk', 1, unixepoch()),
  ('KTR-MSK-SPN', 'MSK-SPN', 'Sponsor', 'masuk', 1, unixepoch()),
  ('KTR-MSK-LNN', 'MSK-LNN', 'Lainnya (masuk)', 'masuk', 1, unixepoch()),
  ('KTR-KLR-SRV', 'KLR-SRV', 'Server dan layanan', 'keluar', 1, unixepoch()),
  ('KTR-KLR-KNT', 'KLR-KNT', 'Konten dan produksi', 'keluar', 1, unixepoch()),
  ('KTR-KLR-EVT', 'KLR-EVT', 'Event dan komunitas', 'keluar', 1, unixepoch()),
  ('KTR-KLR-OPS', 'KLR-OPS', 'Operasional lain', 'keluar', 1, unixepoch()),
  ('KTR-KLR-JSA', 'KLR-JSA', 'Jasa freelance dan reward', 'keluar', 1, unixepoch()),
  ('KTR-KLR-LNN', 'KLR-LNN', 'Lainnya (keluar)', 'keluar', 1, unixepoch());
