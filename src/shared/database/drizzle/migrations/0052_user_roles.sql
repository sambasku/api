-- Multi role (junction user_roles): satu user bisa pegang banyak role.
-- Backfill dari kolom role lama, lalu kolom role dihapus dari users -
-- sumber kebenaran role sejak sini hanya tabel junction.
CREATE TABLE `user_roles` (
	`user_id` text NOT NULL,
	`role` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	PRIMARY KEY(`user_id`, `role`)
);
--> statement-breakpoint
CREATE INDEX `user_roles_user_id_idx` ON `user_roles` (`user_id`);--> statement-breakpoint
CREATE INDEX `user_roles_role_idx` ON `user_roles` (`role`);--> statement-breakpoint
INSERT INTO `user_roles` (`user_id`, `role`)
SELECT `id`, `role` FROM `users`
WHERE `role` IS NOT NULL AND `role` != ''
ON CONFLICT DO NOTHING;--> statement-breakpoint
ALTER TABLE `users` DROP COLUMN `role`;
