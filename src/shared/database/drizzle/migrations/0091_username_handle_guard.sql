-- Guard handle @mention di level DB (bukan cuma app code).
--
-- Invariant: `users.username` = handle lowercase a-z0-9._ sepanjang 3-30.
-- App code (register/OAuth/admin) sudah menormalisasi; trigger ini menutup
-- jalur tulis lain (seed, skrip, kueri manual) yang bisa menyelinap.
--
-- Pengecualian:
-- - `deleted_at IS NOT NULL` = baris soft-delete. Tombstone akun memakai
--   `dihapus-<ULID>` (memuat kapital + hyphen) dan sudah pasti tidak aktif -
--   tidak boleh diblokir.
--
-- Catatan: index unik `users_username_unique` (BINARY) tetap cukup karena
-- trigger memaksa lowercase - `lower(username) = username` untuk semua baris
-- baru, jadi tidak perlu index unik ekspresi terpisah.
--
-- Backfill baris legacy (yang masih kapital/spasi) dijalankan JS di
-- `src/scripts/migrate.ts` (backfillUsernameHandles) - SQLite tidak punya
-- blok DO $$ untuk normalisasi charset.

CREATE TRIGGER `users_username_handle_guard_insert`
BEFORE INSERT ON `users`
FOR EACH ROW
WHEN NEW.`deleted_at` IS NULL AND (
	NEW.`username` != lower(NEW.`username`)
	OR length(NEW.`username`) < 3
	OR length(NEW.`username`) > 30
	OR NEW.`username` GLOB '*[^a-z0-9._]*'
)
BEGIN
	SELECT RAISE(ABORT, 'username harus handle lowercase a-z0-9._ sepanjang 3-30');
END;
--> statement-breakpoint
CREATE TRIGGER `users_username_handle_guard_update`
BEFORE UPDATE ON `users`
FOR EACH ROW
WHEN NEW.`deleted_at` IS NULL AND (
	NEW.`username` != lower(NEW.`username`)
	OR length(NEW.`username`) < 3
	OR length(NEW.`username`) > 30
	OR NEW.`username` GLOB '*[^a-z0-9._]*'
)
BEGIN
	SELECT RAISE(ABORT, 'username harus handle lowercase a-z0-9._ sepanjang 3-30');
END;
