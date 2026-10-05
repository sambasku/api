CREATE TABLE `email_quotas` (
	`provider` text PRIMARY KEY NOT NULL,
	`monthly_limit` integer DEFAULT 3000 NOT NULL,
	`daily_limit` integer DEFAULT 100 NOT NULL,
	`manual_monthly_used` integer DEFAULT 0 NOT NULL,
	`manual_month` text,
	`priority` integer DEFAULT 1 NOT NULL,
	`active` integer DEFAULT 1 NOT NULL,
	`updated_at` integer,
	`updated_by` text,
	FOREIGN KEY (`updated_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `email_usage_daily` (
	`id` text PRIMARY KEY NOT NULL,
	`provider` text NOT NULL,
	`day` text NOT NULL,
	`sent_count` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `email_usage_daily_provider_day_unique` ON `email_usage_daily` (`provider`,`day`);
--> statement-breakpoint
CREATE INDEX `email_usage_daily_day_idx` ON `email_usage_daily` (`day`);
--> statement-breakpoint
CREATE TABLE `email_logs` (
	`id` text PRIMARY KEY NOT NULL,
	`provider` text NOT NULL,
	`category` text NOT NULL,
	`to_email` text NOT NULL,
	`status` text NOT NULL,
	`error_code` text,
	`error_message` text,
	`provider_message_id` text,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `email_logs_created_at_idx` ON `email_logs` (`created_at`);
--> statement-breakpoint
CREATE INDEX `email_logs_status_created_idx` ON `email_logs` (`status`,`created_at`);
--> statement-breakpoint
INSERT INTO `email_quotas` (`provider`, `monthly_limit`, `daily_limit`, `manual_monthly_used`, `manual_month`, `priority`, `active`)
VALUES ('resend', 3000, 100, 36, strftime('%Y-%m', 'now'), 1, 1);
