ALTER TABLE `places` ADD COLUMN `related_json` text NOT NULL DEFAULT '[]';
--> statement-breakpoint
ALTER TABLE `place_images` ADD COLUMN `created_at` integer;
--> statement-breakpoint
UPDATE `places`
SET `related_json` = '[{"kind":"place","slug":"masjid-jami-sultan-muhammad-shafiuddin-ii"}]'
WHERE `slug` = 'istana-alwatzikoebillah';
--> statement-breakpoint
UPDATE `places`
SET `related_json` = '[{"kind":"place","slug":"istana-alwatzikoebillah"}]'
WHERE `slug` = 'masjid-jami-sultan-muhammad-shafiuddin-ii';
--> statement-breakpoint
CREATE TABLE `place_contributions` (
  `id` text PRIMARY KEY NOT NULL,
  `user_id` text NOT NULL,
  `place_id` text,
  `base_updated_at` integer,
  `payload_json` text NOT NULL,
  `status` text NOT NULL DEFAULT 'pending',
  `created_at` integer NOT NULL,
  `reviewed_at` integer
);
--> statement-breakpoint
CREATE INDEX `place_contributions_user_status_idx` ON `place_contributions` (`user_id`, `status`);
--> statement-breakpoint
CREATE INDEX `place_contributions_place_status_idx` ON `place_contributions` (`place_id`, `status`);
--> statement-breakpoint
CREATE INDEX `place_contributions_status_created_idx` ON `place_contributions` (`status`, `created_at`);
