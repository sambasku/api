CREATE TABLE `web_imports` (
`id` text PRIMARY KEY NOT NULL,
`submitted_by` text NOT NULL REFERENCES users(id),
`officer_name` text NOT NULL,
`source_label` text,
`support_name` text,
`support_type` text,
`support_address` text,
`support_title` text,
`support_desc` text,
`status` text NOT NULL DEFAULT 'pending_review',
`total_rows` integer NOT NULL DEFAULT 0,
`reviewed_by` text REFERENCES users(id),
`reviewed_at` integer,
`review_note` text,
`error_message` text,
`created_at` integer NOT NULL,
`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `web_imports_status_idx` ON `web_imports` (`status`);
--> statement-breakpoint
CREATE INDEX `web_imports_status_created_idx` ON `web_imports` (`status`,`id`);
--> statement-breakpoint
CREATE TABLE `web_import_details` (
`id` text PRIMARY KEY NOT NULL,
`import_id` text NOT NULL REFERENCES web_imports(id),
`row_number` integer NOT NULL,
`kata` text NOT NULL,
`terjemahan` text,
`penjelasan_arti` text,
`type` text,
`contoh` text,
`arti_contoh` text,
`status` text NOT NULL DEFAULT 'pending',
`admin_note` text,
`outcome` text,
`outcome_message` text,
`word_id` text REFERENCES words(id),
`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `web_import_details_import_idx` ON `web_import_details` (`import_id`);
--> statement-breakpoint
CREATE INDEX `web_import_details_import_row_idx` ON `web_import_details` (`import_id`,`row_number`);
