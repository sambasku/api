ALTER TABLE `users` ADD `email_verified_at` integer;
--> statement-breakpoint
UPDATE `users` SET `email_verified_at` = `created_at`
  WHERE `email_verified` = 1 AND `email_verified_at` IS NULL;
