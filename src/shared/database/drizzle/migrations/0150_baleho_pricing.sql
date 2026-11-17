-- Migration 0150: tarif Baleho (app_settings) + snapshot harga di placement

INSERT OR IGNORE INTO `app_settings` (`key`, `value`, `type`, `description`, `updated_at`)
VALUES (
  'baleho.price_per_cell_per_day',
  '3000',
  'number',
  'Tarif Baleho: rupiah per sel 1x1 per hari',
  unixepoch() * 1000
);

ALTER TABLE `baleho_placements` ADD `days` integer;
ALTER TABLE `baleho_placements` ADD `price_per_cell_per_day` integer;
ALTER TABLE `baleho_placements` ADD `quoted_amount` integer;
