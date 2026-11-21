-- Pastikan UNIQUE (user_id, target_type, target_id) ada di Turso/sqld.
-- Tanpa index ini, Drizzle ON CONFLICT gagal total (SQLITE_UNKNOWN:
-- ON CONFLICT clause does not match any PRIMARY KEY or UNIQUE constraint)
-- → skip Periksa Kata / deck tidak pernah tercatat.
-- Idempotent: IF NOT EXISTS aman diulang.
CREATE UNIQUE INDEX IF NOT EXISTS `user_skips_user_target_unique`
	ON `user_skips` (`user_id`,`target_type`,`target_id`);
