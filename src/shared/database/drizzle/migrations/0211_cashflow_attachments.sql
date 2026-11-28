-- Lampiran bukti transaksi cashflow (nota, struk, PDF). File disimpan di R2 privat lewat S3 API.
-- Ledger cash_transactions tetap append-only; lampiran ditempel sebagai baris terpisah.
-- Hapus = soft delete (deleted_at). Objek di R2 tidak pernah dihapus oleh aplikasi.

CREATE TABLE `cash_attachments` (
	`id` text PRIMARY KEY NOT NULL,
	`transaction_id` text NOT NULL,
	`object_key` text NOT NULL,
	`original_name` text NOT NULL,
	`mime` text NOT NULL,
	`size_bytes` integer NOT NULL,
	`sha256` text NOT NULL,
	`uploaded_by` text,
	`created_at` integer NOT NULL DEFAULT (unixepoch()),
	`deleted_at` integer,
	`deleted_by` text,
	FOREIGN KEY (`transaction_id`) REFERENCES `cash_transactions`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`uploaded_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`deleted_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT `cash_attachments_size_chk` CHECK (`size_bytes` > 0),
	CONSTRAINT `cash_attachments_mime_chk` CHECK (`mime` IN ('application/pdf', 'image/jpeg', 'image/png', 'image/webp'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `cash_attachments_object_key_uq` ON `cash_attachments` (`object_key`);
--> statement-breakpoint
CREATE INDEX `cash_attachments_tx_idx` ON `cash_attachments` (`transaction_id`);
--> statement-breakpoint
-- Dedupe: file identik (sha256) tidak ditempel dua kali ke transaksi yang sama selama belum dihapus.
CREATE UNIQUE INDEX `cash_attachments_tx_sha_uq` ON `cash_attachments` (`transaction_id`, `sha256`) WHERE `deleted_at` IS NULL;
