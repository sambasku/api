-- Jam/tanggal acara boleh kosong: starts_at & ends_at nullable.
-- CHECK lolos bila salah satu NULL. Swap kolom (hindari DROP TABLE + cascade).
ALTER TABLE `events` ADD COLUMN `starts_at_nullable` integer;--> statement-breakpoint
UPDATE `events` SET `starts_at_nullable` = `starts_at`;--> statement-breakpoint
ALTER TABLE `events` DROP COLUMN `starts_at`;--> statement-breakpoint
ALTER TABLE `events` RENAME COLUMN `starts_at_nullable` TO `starts_at`;--> statement-breakpoint
ALTER TABLE `events` ADD COLUMN `ends_at_nullable` integer;--> statement-breakpoint
UPDATE `events` SET `ends_at_nullable` = `ends_at`;--> statement-breakpoint
ALTER TABLE `events` DROP COLUMN `ends_at`;--> statement-breakpoint
ALTER TABLE `events` RENAME COLUMN `ends_at_nullable` TO `ends_at`;--> statement-breakpoint
-- Index hilang saat DROP COLUMN - buat ulang.
CREATE INDEX `events_starts_at_idx` ON `events` (`starts_at`);--> statement-breakpoint
CREATE INDEX `events_status_starts_at_idx` ON `events` (`status`, `starts_at`);
