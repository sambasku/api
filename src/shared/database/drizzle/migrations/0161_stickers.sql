-- Katalog stiker (chat + komentar). PK = slug stabil.
CREATE TABLE IF NOT EXISTS `stickers` (
  `id` text PRIMARY KEY NOT NULL,
  `image_url` text NOT NULL,
  `play_once` integer DEFAULT false NOT NULL,
  `sort_order` integer DEFAULT 0 NOT NULL,
  `is_active` integer DEFAULT true NOT NULL,
  `created_at` integer NOT NULL,
  `updated_at` integer,
  `deleted_at` integer
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `stickers_active_sort_idx` ON `stickers` (`is_active`,`sort_order`,`id`) WHERE deleted_at is null;
--> statement-breakpoint
-- Seed pack v1 (file di sambasku/images assets/stickers/).
INSERT OR IGNORE INTO `stickers` (`id`, `image_url`, `play_once`, `sort_order`, `is_active`, `created_at`) VALUES
  ('cheer', 'https://cdn.jsdelivr.net/gh/sambasku/images@main/assets/stickers/cheer.png', 0, 10, 1, unixepoch()),
  ('fire', 'https://cdn.jsdelivr.net/gh/sambasku/images@main/assets/stickers/fire.png', 0, 20, 1, unixepoch()),
  ('heart', 'https://cdn.jsdelivr.net/gh/sambasku/images@main/assets/stickers/heart.png', 0, 30, 1, unixepoch()),
  ('ok', 'https://cdn.jsdelivr.net/gh/sambasku/images@main/assets/stickers/ok.png', 0, 40, 1, unixepoch()),
  ('party', 'https://cdn.jsdelivr.net/gh/sambasku/images@main/assets/stickers/party.png', 0, 50, 1, unixepoch()),
  ('pray', 'https://cdn.jsdelivr.net/gh/sambasku/images@main/assets/stickers/pray.png', 0, 60, 1, unixepoch()),
  ('wave', 'https://cdn.jsdelivr.net/gh/sambasku/images@main/assets/stickers/wave.gif', 1, 70, 1, unixepoch());
--> statement-breakpoint
ALTER TABLE `comments` ADD COLUMN `sticker_id` text;
