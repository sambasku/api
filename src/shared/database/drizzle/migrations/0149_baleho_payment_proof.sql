-- Migration 0149: bukti pembayaran Baleho (ImageKit URL + file id)

ALTER TABLE `baleho_placements` ADD `payment_proof_url` text;
ALTER TABLE `baleho_placements` ADD `payment_proof_file_id` text;
