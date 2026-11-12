-- Jinye Phase 2b: laporan OP / komen (admin resolve menyusul).
CREATE TABLE `jinye_reports` (
  `id` text PRIMARY KEY NOT NULL,
  `target_type` text NOT NULL,
  `target_id` text NOT NULL,
  `user_id` text NOT NULL,
  `reason_code` text NOT NULL,
  `note` text,
  `status` text DEFAULT 'open' NOT NULL,
  `resolution` text,
  `resolution_note` text,
  `resolved_by` text,
  `resolved_at` integer,
  `created_at` integer NOT NULL,
  `updated_at` integer
);
--> statement-breakpoint
CREATE INDEX `jinye_reports_status_id_idx` ON `jinye_reports` (`status`,`id`);
--> statement-breakpoint
CREATE INDEX `jinye_reports_target_idx` ON `jinye_reports` (`target_type`,`target_id`,`status`);
--> statement-breakpoint
CREATE UNIQUE INDEX `jinye_reports_open_user_uidx` ON `jinye_reports` (`target_type`,`target_id`,`user_id`) WHERE `status` = 'open';
