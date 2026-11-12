CREATE TABLE `jinye_translations` (
  `id` text PRIMARY KEY NOT NULL,
  `jinye_id` text NOT NULL,
  `body_id` text NOT NULL,
  `status` text DEFAULT 'pending' NOT NULL,
  `translator_id` text NOT NULL,
  `reviewed_by` text,
  `reviewed_at` integer,
  `created_at` integer NOT NULL,
  `updated_at` integer,
  FOREIGN KEY (`jinye_id`) REFERENCES `jinye`(`id`),
  FOREIGN KEY (`translator_id`) REFERENCES `users`(`id`),
  FOREIGN KEY (`reviewed_by`) REFERENCES `users`(`id`)
);
--> statement-breakpoint
CREATE INDEX `jinye_translations_jinye_idx` ON `jinye_translations` (`jinye_id`,`status`);
--> statement-breakpoint
CREATE INDEX `jinye_translations_translator_idx` ON `jinye_translations` (`translator_id`);
