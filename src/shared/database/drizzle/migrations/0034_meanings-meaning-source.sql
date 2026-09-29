-- Provenance makna: ketik manual vs pilih KBBI vs diubah setelah KBBI.
ALTER TABLE `meanings` ADD `meaning_source` text DEFAULT 'manual' NOT NULL;
