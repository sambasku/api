-- Migration 0150: seed tarif Baleho di app_settings.
-- Versi awal tanpa breakpoint hanya menjalankan INSERT ini.
-- Kolom snapshot harga di placement dilengkapi di 0152.

INSERT OR IGNORE INTO `app_settings` (`key`, `value`, `type`, `description`, `updated_at`)
VALUES (
  'baleho.price_per_cell_per_day',
  '3000',
  'number',
  'Tarif Baleho: rupiah per sel 1x1 per hari',
  unixepoch() * 1000
);
