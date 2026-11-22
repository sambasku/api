-- Rapihkan rancu Kuliner vs Tempat Kuliner: penjual kuliner = Usaha.
-- Junction baru cuisine_usahas menggantikan culinary_place_cuisines;
-- culinary_places + culinary_place_cuisines dihapus (belum ada data
-- produksi - kontrak Kuliner -> Usaha, tanpa konversi).
CREATE TABLE `cuisine_usahas` (
	`id` text PRIMARY KEY NOT NULL,
	`cuisine_id` text NOT NULL,
	`usaha_id` text NOT NULL,
	`availability` text DEFAULT 'unknown' NOT NULL,
	`note` text,
	`publish_status` text DEFAULT 'published' NOT NULL,
	`author_id` text,
	`created_at` integer NOT NULL,
	`updated_at` integer,
	`deleted_at` integer,
	FOREIGN KEY (`cuisine_id`) REFERENCES `cuisines`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`usaha_id`) REFERENCES `usahas`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE INDEX `cuisine_usahas_cuisine_idx` ON `cuisine_usahas` (`cuisine_id`,`publish_status`);
--> statement-breakpoint
CREATE INDEX `cuisine_usahas_usaha_idx` ON `cuisine_usahas` (`usaha_id`,`publish_status`);
--> statement-breakpoint
CREATE UNIQUE INDEX `cuisine_usahas_pair_uidx` ON `cuisine_usahas` (`cuisine_id`,`usaha_id`) WHERE `cuisine_usahas`.`deleted_at` IS NULL;
--> statement-breakpoint
DROP TABLE IF EXISTS `culinary_claims`;
--> statement-breakpoint
DROP TABLE IF EXISTS `culinary_reports`;
--> statement-breakpoint
DROP TABLE IF EXISTS `culinary_place_cuisines`;
--> statement-breakpoint
DROP TABLE IF EXISTS `culinary_places`;
--> statement-breakpoint
ALTER TABLE `culinary_contributions` RENAME COLUMN `place_id` TO `usaha_id`;
--> statement-breakpoint
ALTER TABLE `culinary_contributions` RENAME COLUMN `result_place_id` TO `result_usaha_id`;
--> statement-breakpoint
DROP INDEX IF EXISTS `culinary_contributions_place_idx`;
--> statement-breakpoint
CREATE INDEX `culinary_contributions_usaha_idx` ON `culinary_contributions` (`usaha_id`,`status`);
