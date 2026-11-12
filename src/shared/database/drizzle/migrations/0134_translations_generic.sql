-- 0134: tabel generik translations (reff + reff_id); pindah dari jinye_translations.

CREATE TABLE `translations` (
  `id` text PRIMARY KEY NOT NULL,
  `reff` text NOT NULL,
  `reff_id` text NOT NULL,
  `body` text NOT NULL,
  `status` text DEFAULT 'pending' NOT NULL,
  `translator_id` text NOT NULL,
  `reviewed_by` text,
  `reviewed_at` integer,
  `created_at` integer NOT NULL,
  `updated_at` integer,
  FOREIGN KEY (`translator_id`) REFERENCES `users`(`id`),
  FOREIGN KEY (`reviewed_by`) REFERENCES `users`(`id`)
);
--> statement-breakpoint
CREATE INDEX `translations_reff_idx` ON `translations` (`reff`,`reff_id`,`status`);
--> statement-breakpoint
CREATE INDEX `translations_translator_idx` ON `translations` (`translator_id`);
--> statement-breakpoint

-- Pindah baris lama (idempoten: INSERT OR IGNORE by PK).
INSERT OR IGNORE INTO `translations` (
  `id`, `reff`, `reff_id`, `body`, `status`,
  `translator_id`, `reviewed_by`, `reviewed_at`, `created_at`, `updated_at`
)
SELECT
  `id`,
  'jinye',
  `jinye_id`,
  `body_id`,
  `status`,
  `translator_id`,
  `reviewed_by`,
  `reviewed_at`,
  `created_at`,
  `updated_at`
FROM `jinye_translations`;
--> statement-breakpoint

DROP TABLE `jinye_translations`;
