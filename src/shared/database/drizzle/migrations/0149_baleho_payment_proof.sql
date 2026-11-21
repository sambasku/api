-- Migration 0149: bukti pembayaran Baleho (ImageKit URL + file id)
-- Versi awal tanpa breakpoint hanya menambah payment_proof_url.
-- Kolom payment_proof_file_id dilengkapi di 0152.

ALTER TABLE `baleho_placements` ADD `payment_proof_url` text;
