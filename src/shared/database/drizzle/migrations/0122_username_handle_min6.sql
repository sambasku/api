-- Naikkan min handle username dari 3 → 6 (selaras USERNAME_HANDLE_REGEX app).
-- Backfill baris pendek dijalankan JS di `src/scripts/migrate.ts`
-- (backfillUsernameHandles) sebelum & sesudah migrate ini.
--
-- Soft-delete tetap dikecualikan (tombstone `dihapus-<ULID>`).

DROP TRIGGER IF EXISTS `users_username_handle_guard_insert`;
--> statement-breakpoint
DROP TRIGGER IF EXISTS `users_username_handle_guard_update`;
--> statement-breakpoint
CREATE TRIGGER `users_username_handle_guard_insert`
BEFORE INSERT ON `users`
FOR EACH ROW
WHEN NEW.`deleted_at` IS NULL AND (
	NEW.`username` != lower(NEW.`username`)
	OR length(NEW.`username`) < 6
	OR length(NEW.`username`) > 30
	OR NEW.`username` GLOB '*[^a-z0-9._]*'
)
BEGIN
	SELECT RAISE(ABORT, 'username harus handle lowercase a-z0-9._ sepanjang 6-30');
END;
--> statement-breakpoint
CREATE TRIGGER `users_username_handle_guard_update`
BEFORE UPDATE ON `users`
FOR EACH ROW
WHEN NEW.`deleted_at` IS NULL AND (
	NEW.`username` != lower(NEW.`username`)
	OR length(NEW.`username`) < 6
	OR length(NEW.`username`) > 30
	OR NEW.`username` GLOB '*[^a-z0-9._]*'
)
BEGIN
	SELECT RAISE(ABORT, 'username harus handle lowercase a-z0-9._ sepanjang 6-30');
END;
