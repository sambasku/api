-- username = handle @mention (a-z0-9._- historis; lihat 0028 tanpa hyphen);
-- display_name = nama profil manusiawi.
-- Backfill display_name kosong dari username lama.
-- Slugify username yang tidak valid: dijalankan di src/scripts/migrate.ts
-- (Turso/SQLite tidak mendukung blok DO $$ PostgreSQL).

UPDATE users
SET display_name = username
WHERE (display_name IS NULL OR display_name = '')
  AND username IS NOT NULL;
