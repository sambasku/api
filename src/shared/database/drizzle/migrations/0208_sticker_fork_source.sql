-- Fork stiker saat difavoritkan: salinan milik favoriter menyimpan asal.
-- Favorit lama tetap referensi ke stiker asal (tanpa migrasi data).
ALTER TABLE `stickers` ADD `source_sticker_id` text;--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `stickers_owner_source_uniq` ON `stickers` (`owner_user_id`, `source_sticker_id`) WHERE `source_sticker_id` IS NOT NULL AND `deleted_at` IS NULL;
