-- Pastikan UNIQUE (term, direction) ada di sqld lokal/staging.
-- Tanpa index ini, Drizzle `ON CONFLICT (term, direction)` gagal total
-- (SQLITE_UNKNOWN: ON CONFLICT clause does not match any PRIMARY KEY or
-- UNIQUE constraint) → search miss tidak pernah tercatat.
-- Idempotent: IF NOT EXISTS aman diulang.
CREATE UNIQUE INDEX IF NOT EXISTS `search_misses_term_direction_unique`
	ON `search_misses` (`term`, `direction`);--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `search_miss_searchers_miss_user_unique`
	ON `search_miss_searchers` (`search_miss_id`, `user_id`);
