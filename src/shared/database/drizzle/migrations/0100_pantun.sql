-- Fitur Pantun (PRD Pantun): pantun 4 baris ABAB/AAAA di kategori Hiburan.
-- Post-moderation: pantun langsung published; admin bisa takedown.
-- Balasan satu level: pantun_replies.parent_id -> pantuns.id (pantun pembuka).
CREATE TABLE `pantuns` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL REFERENCES users(id),
	`category_id` text REFERENCES categories(id),
	`language` text DEFAULT 'id' NOT NULL,
	`rhyme_scheme` text NOT NULL,
	`lines` text NOT NULL,
	`status` text DEFAULT 'published' NOT NULL,
	`taken_down_by` text REFERENCES users(id),
	`taken_down_at` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer
);
--> statement-breakpoint
CREATE INDEX `pantuns_status_id_idx` ON `pantuns` (`status`,`id`);
--> statement-breakpoint
CREATE INDEX `pantuns_category_status_idx` ON `pantuns` (`category_id`,`status`,`id`);
--> statement-breakpoint
CREATE TABLE `pantun_replies` (
	`id` text PRIMARY KEY NOT NULL,
	`parent_id` text NOT NULL REFERENCES pantuns(id),
	`user_id` text NOT NULL REFERENCES users(id),
	`category_id` text REFERENCES categories(id),
	`language` text DEFAULT 'id' NOT NULL,
	`rhyme_scheme` text NOT NULL,
	`lines` text NOT NULL,
	`status` text DEFAULT 'published' NOT NULL,
	`taken_down_by` text REFERENCES users(id),
	`taken_down_at` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer
);
--> statement-breakpoint
CREATE INDEX `pantun_replies_parent_created_idx` ON `pantun_replies` (`parent_id`,`created_at`,`id`);
--> statement-breakpoint
CREATE INDEX `pantun_replies_status_idx` ON `pantun_replies` (`status`,`id`);
