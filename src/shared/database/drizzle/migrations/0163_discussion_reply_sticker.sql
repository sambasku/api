-- Stiker katalog pada balasan diskusi (sama slug stickers.id).
ALTER TABLE `discussion_replies` ADD COLUMN `sticker_id` text;
