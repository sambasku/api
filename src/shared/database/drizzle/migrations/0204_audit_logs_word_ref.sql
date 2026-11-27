ALTER TABLE `audit_logs` ADD COLUMN `word_ref` text GENERATED ALWAYS AS (coalesce(json_extract(`new_data`, '$.word_id'), json_extract(`old_data`, '$.word_id'))) VIRTUAL;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `audit_logs_word_ref_idx` ON `audit_logs` (`word_ref`, `id`);
