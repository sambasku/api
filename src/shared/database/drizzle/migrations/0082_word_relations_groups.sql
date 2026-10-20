-- PRD relasi-lemma (docs/backlogs/PRD-relasi-lemma-sambasku.md):
-- 1) lexical_relations dapatkan status moderasi per baris. Kolom DEFAULT
--    'published'/'false' = backfill baris lama otomatis dianggap tayang
--    (relasi era sebelum moderasi memang selalu tayang).
-- 2) Tabel baru kelompok makna (word_groups + word_group_members).
ALTER TABLE `lexical_relations` ADD `status` text NOT NULL DEFAULT 'published';
--> statement-breakpoint
ALTER TABLE `lexical_relations` ADD `is_verified` boolean NOT NULL DEFAULT false;
--> statement-breakpoint
ALTER TABLE `lexical_relations` ADD `updated_by` text REFERENCES users(id);
--> statement-breakpoint
ALTER TABLE `lexical_relations` ADD `updated_at` integer;
--> statement-breakpoint
CREATE TABLE `word_groups` (
`id` text PRIMARY KEY NOT NULL,
`name` text NOT NULL,
`description` text,
`status` text NOT NULL DEFAULT 'pending_review',
`is_verified` boolean NOT NULL DEFAULT false,
`created_by` text REFERENCES users(id),
`updated_by` text REFERENCES users(id),
`updated_at` integer,
`deleted_at` integer,
`deleted_by` text REFERENCES users(id),
`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `word_group_members` (
`id` text PRIMARY KEY NOT NULL,
`group_id` text NOT NULL,
`word_id` text NOT NULL,
`notes` text,
`status` text NOT NULL DEFAULT 'pending_review',
`created_by` text REFERENCES users(id),
`updated_by` text REFERENCES users(id),
`updated_at` integer,
`deleted_at` integer,
`deleted_by` text REFERENCES users(id),
`created_at` integer NOT NULL,
FOREIGN KEY (`group_id`) REFERENCES `word_groups`(`id`) ON UPDATE no action ON DELETE no action,
FOREIGN KEY (`word_id`) REFERENCES `words`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `word_group_members_unique` ON `word_group_members` (`group_id`,`word_id`);
--> statement-breakpoint
CREATE INDEX `word_group_members_word_idx` ON `word_group_members` (`word_id`);
--> statement-breakpoint
CREATE INDEX `word_group_members_group_idx` ON `word_group_members` (`group_id`);
