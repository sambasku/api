CREATE TABLE `supabase_health_checks` (
	`id` text PRIMARY KEY NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`project_label` text NOT NULL,
	`project_ref` text NOT NULL,
	`env` text DEFAULT 'staging' NOT NULL,
	`http_status` integer,
	`status` text NOT NULL,
	`time_start` integer,
	`time_end` integer,
	`duration_ms` integer,
	`github_run_id` text,
	`github_run_url` text,
	`error_message` text
);--> statement-breakpoint
CREATE INDEX `supabase_health_checks_env_created_idx` ON `supabase_health_checks` (`env`,`created_at`);
