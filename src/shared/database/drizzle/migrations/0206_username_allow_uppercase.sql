-- Izinkan huruf besar [A-Z] pada username handle (case-preserving),
-- dengan keunikan & lookup case-insensitive lewat index lower(username).
-- Selaras USERNAME_HANDLE_REGEX app: [a-zA-Z0-9._], 6-30 karakter,
-- wajib mulai/akhir alfanumerik, tanpa separator beruntun.
--
-- Soft-delete tetap dikecualikan (tombstone `dihapus-<ULID>`).

CREATE UNIQUE INDEX IF NOT EXISTS `users_username_lower_unique` ON `users` (lower(`username`));
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `username_changes_old_username_lower_idx` ON `username_changes` (lower(`old_username`)) WHERE `released_at` IS NULL;
--> statement-breakpoint
DROP TRIGGER IF EXISTS `users_username_handle_guard_insert`;
--> statement-breakpoint
DROP TRIGGER IF EXISTS `users_username_handle_guard_update`;
--> statement-breakpoint
CREATE TRIGGER `users_username_handle_guard_insert`
BEFORE INSERT ON `users`
FOR EACH ROW
WHEN NEW.`deleted_at` IS NULL AND (
	length(NEW.`username`) < 6
	OR length(NEW.`username`) > 30
	OR NEW.`username` GLOB '*[^a-zA-Z0-9._]*'
	OR NEW.`username` GLOB '.*'
	OR NEW.`username` GLOB '_*'
	OR NEW.`username` GLOB '*.'
	OR NEW.`username` GLOB '*_'
	OR NEW.`username` GLOB '*..*'
	OR NEW.`username` GLOB '*__*'
	OR NEW.`username` GLOB '*._*'
	OR NEW.`username` GLOB '*_.*'
)
BEGIN
	SELECT RAISE(ABORT, 'username harus handle a-zA-Z0-9._ sepanjang 6-30 tanpa separator beruntun');
END;
--> statement-breakpoint
CREATE TRIGGER `users_username_handle_guard_update`
BEFORE UPDATE ON `users`
FOR EACH ROW
WHEN NEW.`deleted_at` IS NULL AND (
	length(NEW.`username`) < 6
	OR length(NEW.`username`) > 30
	OR NEW.`username` GLOB '*[^a-zA-Z0-9._]*'
	OR NEW.`username` GLOB '.*'
	OR NEW.`username` GLOB '_*'
	OR NEW.`username` GLOB '*.'
	OR NEW.`username` GLOB '*_'
	OR NEW.`username` GLOB '*..*'
	OR NEW.`username` GLOB '*__*'
	OR NEW.`username` GLOB '*._*'
	OR NEW.`username` GLOB '*_.*'
)
BEGIN
	SELECT RAISE(ABORT, 'username harus handle a-zA-Z0-9._ sepanjang 6-30 tanpa separator beruntun');
END;
