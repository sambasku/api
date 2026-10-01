-- Kredit foto stock Media Explorer (Unsplash/Openverse CC/Pixabay) per gambar
-- kata: JSON {name, url?, license?, license_url?, source?}. Null untuk upload
-- user dan baris lama (tanpa backfill).
ALTER TABLE `word_images` ADD `attribution` text;
