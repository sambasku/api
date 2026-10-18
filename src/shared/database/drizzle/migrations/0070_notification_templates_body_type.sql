ALTER TABLE `notification_templates` ADD `body_type` text NOT NULL DEFAULT 'plain';--> statement-breakpoint
ALTER TABLE `notification_campaigns` ADD `body_type` text NOT NULL DEFAULT 'plain';
