-- Stiker katalog pada komentar artikel ensiklopedia (sama slug stickers.id).
ALTER TABLE `article_comments` ADD COLUMN `sticker_id` text;
