-- year opsional: usulan cepat + approve boleh tanpa tahun rilis.
-- Swap via kolom sementara (hindari DROP TABLE + cascade credits/excerpts).
ALTER TABLE `karyas` ADD COLUMN `year_nullable` integer;--> statement-breakpoint
UPDATE `karyas` SET `year_nullable` = `year`;--> statement-breakpoint
ALTER TABLE `karyas` DROP COLUMN `year`;--> statement-breakpoint
ALTER TABLE `karyas` RENAME COLUMN `year_nullable` TO `year`;--> statement-breakpoint
CREATE INDEX `karyas_status_year_idx` ON `karyas` (`publish_status`, `year`);
