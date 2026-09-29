CREATE TABLE `database_backup_logs` (
	`id` text PRIMARY KEY NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`triggered_by_user_id` text,
	`triggered_by_username` text,
	`trigger_source` text DEFAULT 'console' NOT NULL,
	`dry_run` integer DEFAULT false NOT NULL,
	`status` text NOT NULL,
	`time_start` integer,
	`time_end` integer,
	`duration_ms` integer,
	`size_bytes` integer,
	`sha256` text,
	`database_label` text,
	`asset_name` text,
	`release_url` text,
	`github_release_tag` text,
	`github_run_id` text,
	`github_run_url` text,
	`error_message` text
);--> statement-breakpoint
CREATE INDEX `database_backup_logs_created_idx` ON `database_backup_logs` (`created_at`);--> statement-breakpoint
CREATE INDEX `database_backup_logs_status_created_idx` ON `database_backup_logs` (`status`,`created_at`);
