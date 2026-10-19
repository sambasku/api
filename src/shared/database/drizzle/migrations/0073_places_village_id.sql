ALTER TABLE `places` ADD `village_id` text;
--> statement-breakpoint
CREATE INDEX `places_village_id_idx` ON `places` (`village_id`);
