ALTER TABLE `stickers` ADD COLUMN `category_slug` text;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `stickers_active_category_sort_idx`
  ON `stickers` (`is_active`,`category_slug`,`sort_order`,`id`)
  WHERE deleted_at is null;
