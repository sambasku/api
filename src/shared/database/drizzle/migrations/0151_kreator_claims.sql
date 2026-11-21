CREATE TABLE `kreator_claims` (
	`id` text PRIMARY KEY NOT NULL,
	`kreator_id` text NOT NULL,
	`user_id` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`proof_note` text NOT NULL,
	`reject_reason` text,
	`created_at` integer NOT NULL,
	`updated_at` integer,
	FOREIGN KEY (`kreator_id`) REFERENCES `kreators`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `kreator_claims_pending_uidx` ON `kreator_claims` (`kreator_id`,`user_id`) WHERE "kreator_claims"."status" = 'pending';--> statement-breakpoint
CREATE INDEX `kreator_claims_status_idx` ON `kreator_claims` (`status`,`created_at`);--> statement-breakpoint
CREATE INDEX `kreator_claims_user_idx` ON `kreator_claims` (`user_id`,`status`);