-- Repair kolom Baleho yang terlewat saat 0149/0150 tanpa statement-breakpoint.
INSERT OR IGNORE INTO `app_settings` (`key`, `value`, `type`, `description`, `updated_at`) VALUES ('baleho.price_per_cell_per_day', '3000', 'number', 'Tarif Baleho: rupiah per sel 1x1 per hari', unixepoch() * 1000);--> statement-breakpoint
ALTER TABLE `baleho_placements` ADD `payment_proof_file_id` text;--> statement-breakpoint
ALTER TABLE `baleho_placements` ADD `days` integer;--> statement-breakpoint
ALTER TABLE `baleho_placements` ADD `price_per_cell_per_day` integer;--> statement-breakpoint
ALTER TABLE `baleho_placements` ADD `quoted_amount` integer;
