-- Poster acara jadi banyak gambar: `poster_url` (satu) -> `poster_urls` (array).
-- Urutan array = urutan unggah; elemen [0] dipakai sebagai sampul di kartu feed.
-- Data lama (kalau ada) dipindah apa adanya, baris tanpa poster jadi '[]'.
ALTER TABLE `events` ADD COLUMN `poster_urls` text DEFAULT '[]' NOT NULL;
--> statement-breakpoint
UPDATE `events`
SET `poster_urls` = json_array(`poster_url`)
WHERE `poster_url` IS NOT NULL AND `poster_url` <> '';
--> statement-breakpoint
ALTER TABLE `events` DROP COLUMN `poster_url`;
