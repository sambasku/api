PRAGMA foreign_keys=OFF;
--> statement-breakpoint
CREATE TABLE `baleho_occupancy_new` (
	`slide` integer NOT NULL,
	`col` integer NOT NULL,
	`row` integer NOT NULL,
	`placement_id` text NOT NULL,
	FOREIGN KEY (`placement_id`) REFERENCES `baleho_placements`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `baleho_occupancy_new` SELECT `slide`, `col`, `row`, `placement_id` FROM `baleho_occupancy`;
--> statement-breakpoint
DROP TABLE `baleho_occupancy`;
--> statement-breakpoint
ALTER TABLE `baleho_occupancy_new` RENAME TO `baleho_occupancy`;
--> statement-breakpoint
CREATE INDEX `baleho_occupancy_placement_idx` ON `baleho_occupancy` (`placement_id`);
--> statement-breakpoint
CREATE UNIQUE INDEX `baleho_occupancy_cell_placement_uq` ON `baleho_occupancy` (`slide`, `col`, `row`, `placement_id`);
--> statement-breakpoint
PRAGMA foreign_keys=ON;