-- #47 - timeline feed: baris "word" permanen mengikat di paling atas feed.
--
-- Kolom `integer(..., { mode: 'timestamp' })` di Drizzle menyimpan epoch
-- SECONDS. Sebagian baris impor CSV tersimpan epoch MILLISECONDS (~1.79e12).
-- Dibaca sebagai detik -> dikali 1000 -> tahun 58716, dan akibatnya:
--   - `ORDER BY verified_at DESC` menaruh baris itu permanen di atas feed
--     (pagination keyset ikut salah karena batasnya ikut condong);
--   - klien mobile menghitung diff negatif -> di-clamp -> dirender "baru".
--
-- Ambang 1e11: kalau dibaca sebagai detik itu tahun 5138, jadi mustahil ada
-- timestamp detik yang benar di atas ambang ini. Perbaikan hanya menyentuh baris
-- yang hasil bagi-1000-nya masih di rentang detik wajar.
-- Idempoten: setelah division tidak ada lagi nilai >= 1e11, jadi aman diulang.
--
-- CATATAN: driver libSQL melempar error palsu ("SQLITE_UNKNOWN_0: not an
-- error") untuk chunk yang isinya komentar saja, jadi setiap
-- `statement-breakpoint` di file ini WAJIB diikuti statement SQL.
UPDATE `words` SET `created_at` = `created_at` / 1000
 WHERE `created_at` IS NOT NULL AND `created_at` >= 100000000000 AND `created_at` / 1000 < 10000000000
--> statement-breakpoint
UPDATE `words` SET `updated_at` = `updated_at` / 1000
 WHERE `updated_at` IS NOT NULL AND `updated_at` >= 100000000000 AND `updated_at` / 1000 < 10000000000
--> statement-breakpoint
UPDATE `words` SET `verified_at` = `verified_at` / 1000
 WHERE `verified_at` IS NOT NULL AND `verified_at` >= 100000000000 AND `verified_at` / 1000 < 10000000000
--> statement-breakpoint
UPDATE `words` SET `deleted_at` = `deleted_at` / 1000
 WHERE `deleted_at` IS NOT NULL AND `deleted_at` >= 100000000000 AND `deleted_at` / 1000 < 10000000000
--> statement-breakpoint
UPDATE `words` SET `taken_down_at` = `taken_down_at` / 1000
 WHERE `taken_down_at` IS NOT NULL AND `taken_down_at` >= 100000000000 AND `taken_down_at` / 1000 < 10000000000
--> statement-breakpoint
UPDATE `comments` SET `created_at` = `created_at` / 1000
 WHERE `created_at` IS NOT NULL AND `created_at` >= 100000000000 AND `created_at` / 1000 < 10000000000
--> statement-breakpoint
UPDATE `comments` SET `updated_at` = `updated_at` / 1000
 WHERE `updated_at` IS NOT NULL AND `updated_at` >= 100000000000 AND `updated_at` / 1000 < 10000000000
--> statement-breakpoint
UPDATE `comments` SET `reviewed_at` = `reviewed_at` / 1000
 WHERE `reviewed_at` IS NOT NULL AND `reviewed_at` >= 100000000000 AND `reviewed_at` / 1000 < 10000000000
--> statement-breakpoint
UPDATE `comments` SET `deleted_at` = `deleted_at` / 1000
 WHERE `deleted_at` IS NOT NULL AND `deleted_at` >= 100000000000 AND `deleted_at` / 1000 < 10000000000
--> statement-breakpoint
UPDATE `votes` SET `created_at` = `created_at` / 1000
 WHERE `created_at` IS NOT NULL AND `created_at` >= 100000000000 AND `created_at` / 1000 < 10000000000
--> statement-breakpoint
UPDATE `votes` SET `updated_at` = `updated_at` / 1000
 WHERE `updated_at` IS NOT NULL AND `updated_at` >= 100000000000 AND `updated_at` / 1000 < 10000000000
--> statement-breakpoint
UPDATE `discussions` SET `created_at` = `created_at` / 1000
 WHERE `created_at` IS NOT NULL AND `created_at` >= 100000000000 AND `created_at` / 1000 < 10000000000
--> statement-breakpoint
UPDATE `discussions` SET `updated_at` = `updated_at` / 1000
 WHERE `updated_at` IS NOT NULL AND `updated_at` >= 100000000000 AND `updated_at` / 1000 < 10000000000
--> statement-breakpoint
UPDATE `discussions` SET `reviewed_at` = `reviewed_at` / 1000
 WHERE `reviewed_at` IS NOT NULL AND `reviewed_at` >= 100000000000 AND `reviewed_at` / 1000 < 10000000000
--> statement-breakpoint
UPDATE `discussion_replies` SET `created_at` = `created_at` / 1000
 WHERE `created_at` IS NOT NULL AND `created_at` >= 100000000000 AND `created_at` / 1000 < 10000000000
--> statement-breakpoint
UPDATE `discussion_replies` SET `updated_at` = `updated_at` / 1000
 WHERE `updated_at` IS NOT NULL AND `updated_at` >= 100000000000 AND `updated_at` / 1000 < 10000000000
--> statement-breakpoint
UPDATE `discussion_replies` SET `reviewed_at` = `reviewed_at` / 1000
 WHERE `reviewed_at` IS NOT NULL AND `reviewed_at` >= 100000000000 AND `reviewed_at` / 1000 < 10000000000
--> statement-breakpoint
UPDATE `users` SET `created_at` = `created_at` / 1000
 WHERE `created_at` IS NOT NULL AND `created_at` >= 100000000000 AND `created_at` / 1000 < 10000000000
--> statement-breakpoint
UPDATE `users` SET `updated_at` = `updated_at` / 1000
 WHERE `updated_at` IS NOT NULL AND `updated_at` >= 100000000000 AND `updated_at` / 1000 < 10000000000
--> statement-breakpoint
UPDATE `users` SET `email_verified_at` = `email_verified_at` / 1000
 WHERE `email_verified_at` IS NOT NULL AND `email_verified_at` >= 100000000000 AND `email_verified_at` / 1000 < 10000000000
--> statement-breakpoint
UPDATE `users` SET `deleted_at` = `deleted_at` / 1000
 WHERE `deleted_at` IS NOT NULL AND `deleted_at` >= 100000000000 AND `deleted_at` / 1000 < 10000000000
--> statement-breakpoint
UPDATE `search_misses` SET `created_at` = `created_at` / 1000
 WHERE `created_at` IS NOT NULL AND `created_at` >= 100000000000 AND `created_at` / 1000 < 10000000000
--> statement-breakpoint
UPDATE `search_misses` SET `updated_at` = `updated_at` / 1000
 WHERE `updated_at` IS NOT NULL AND `updated_at` >= 100000000000 AND `updated_at` / 1000 < 10000000000
--> statement-breakpoint
UPDATE `search_misses` SET `last_searched_at` = `last_searched_at` / 1000
 WHERE `last_searched_at` IS NOT NULL AND `last_searched_at` >= 100000000000 AND `last_searched_at` / 1000 < 10000000000
--> statement-breakpoint
UPDATE `search_misses` SET `deleted_at` = `deleted_at` / 1000
 WHERE `deleted_at` IS NOT NULL AND `deleted_at` >= 100000000000 AND `deleted_at` / 1000 < 10000000000
--> statement-breakpoint
UPDATE `word_card_shares` SET `created_at` = `created_at` / 1000
 WHERE `created_at` IS NOT NULL AND `created_at` >= 100000000000 AND `created_at` / 1000 < 10000000000
--> statement-breakpoint
UPDATE `word_edit_suggestions` SET `created_at` = `created_at` / 1000
 WHERE `created_at` IS NOT NULL AND `created_at` >= 100000000000 AND `created_at` / 1000 < 10000000000
--> statement-breakpoint
UPDATE `word_edit_suggestions` SET `updated_at` = `updated_at` / 1000
 WHERE `updated_at` IS NOT NULL AND `updated_at` >= 100000000000 AND `updated_at` / 1000 < 10000000000
--> statement-breakpoint
UPDATE `word_edit_suggestions` SET `reviewed_at` = `reviewed_at` / 1000
 WHERE `reviewed_at` IS NOT NULL AND `reviewed_at` >= 100000000000 AND `reviewed_at` / 1000 < 10000000000
--> statement-breakpoint
UPDATE `word_edit_suggestions` SET `deleted_at` = `deleted_at` / 1000
 WHERE `deleted_at` IS NOT NULL AND `deleted_at` >= 100000000000 AND `deleted_at` / 1000 < 10000000000
--> statement-breakpoint
-- Jaga: kolom tanggal di atas HANYA boleh epoch detik dalam rentang wajar.
-- Menangkap jalur tulis di luar aplikasi (SQL langsung, impor skrip),
-- yang tidak bisa dijaga oleh kode TypeScript.
CREATE TRIGGER `words_ts_unit_guard_insert`
BEFORE INSERT ON `words`
FOR EACH ROW
WHEN (NEW.`created_at` >= 100000000000
   OR NEW.`updated_at` >= 100000000000
   OR NEW.`verified_at` >= 100000000000
   OR NEW.`deleted_at` >= 100000000000
   OR NEW.`taken_down_at` >= 100000000000)
BEGIN
  SELECT RAISE(ABORT, 'epoch timestamp must be seconds, got milliseconds');
END
--> statement-breakpoint
CREATE TRIGGER `words_ts_unit_guard_update`
BEFORE UPDATE ON `words`
FOR EACH ROW
WHEN (NEW.`created_at` >= 100000000000
   OR NEW.`updated_at` >= 100000000000
   OR NEW.`verified_at` >= 100000000000
   OR NEW.`deleted_at` >= 100000000000
   OR NEW.`taken_down_at` >= 100000000000)
BEGIN
  SELECT RAISE(ABORT, 'epoch timestamp must be seconds, got milliseconds');
END
--> statement-breakpoint
CREATE TRIGGER `comments_ts_unit_guard_insert`
BEFORE INSERT ON `comments`
FOR EACH ROW
WHEN (NEW.`created_at` >= 100000000000
   OR NEW.`updated_at` >= 100000000000
   OR NEW.`reviewed_at` >= 100000000000
   OR NEW.`deleted_at` >= 100000000000)
BEGIN
  SELECT RAISE(ABORT, 'epoch timestamp must be seconds, got milliseconds');
END
--> statement-breakpoint
CREATE TRIGGER `comments_ts_unit_guard_update`
BEFORE UPDATE ON `comments`
FOR EACH ROW
WHEN (NEW.`created_at` >= 100000000000
   OR NEW.`updated_at` >= 100000000000
   OR NEW.`reviewed_at` >= 100000000000
   OR NEW.`deleted_at` >= 100000000000)
BEGIN
  SELECT RAISE(ABORT, 'epoch timestamp must be seconds, got milliseconds');
END
--> statement-breakpoint
CREATE TRIGGER `votes_ts_unit_guard_insert`
BEFORE INSERT ON `votes`
FOR EACH ROW
WHEN (NEW.`created_at` >= 100000000000
   OR NEW.`updated_at` >= 100000000000)
BEGIN
  SELECT RAISE(ABORT, 'epoch timestamp must be seconds, got milliseconds');
END
--> statement-breakpoint
CREATE TRIGGER `votes_ts_unit_guard_update`
BEFORE UPDATE ON `votes`
FOR EACH ROW
WHEN (NEW.`created_at` >= 100000000000
   OR NEW.`updated_at` >= 100000000000)
BEGIN
  SELECT RAISE(ABORT, 'epoch timestamp must be seconds, got milliseconds');
END
--> statement-breakpoint
CREATE TRIGGER `discussions_ts_unit_guard_insert`
BEFORE INSERT ON `discussions`
FOR EACH ROW
WHEN (NEW.`created_at` >= 100000000000
   OR NEW.`updated_at` >= 100000000000
   OR NEW.`reviewed_at` >= 100000000000)
BEGIN
  SELECT RAISE(ABORT, 'epoch timestamp must be seconds, got milliseconds');
END
--> statement-breakpoint
CREATE TRIGGER `discussions_ts_unit_guard_update`
BEFORE UPDATE ON `discussions`
FOR EACH ROW
WHEN (NEW.`created_at` >= 100000000000
   OR NEW.`updated_at` >= 100000000000
   OR NEW.`reviewed_at` >= 100000000000)
BEGIN
  SELECT RAISE(ABORT, 'epoch timestamp must be seconds, got milliseconds');
END
--> statement-breakpoint
CREATE TRIGGER `discussion_replies_ts_unit_guard_insert`
BEFORE INSERT ON `discussion_replies`
FOR EACH ROW
WHEN (NEW.`created_at` >= 100000000000
   OR NEW.`updated_at` >= 100000000000
   OR NEW.`reviewed_at` >= 100000000000)
BEGIN
  SELECT RAISE(ABORT, 'epoch timestamp must be seconds, got milliseconds');
END
--> statement-breakpoint
CREATE TRIGGER `discussion_replies_ts_unit_guard_update`
BEFORE UPDATE ON `discussion_replies`
FOR EACH ROW
WHEN (NEW.`created_at` >= 100000000000
   OR NEW.`updated_at` >= 100000000000
   OR NEW.`reviewed_at` >= 100000000000)
BEGIN
  SELECT RAISE(ABORT, 'epoch timestamp must be seconds, got milliseconds');
END
--> statement-breakpoint
CREATE TRIGGER `users_ts_unit_guard_insert`
BEFORE INSERT ON `users`
FOR EACH ROW
WHEN (NEW.`created_at` >= 100000000000
   OR NEW.`updated_at` >= 100000000000
   OR NEW.`email_verified_at` >= 100000000000
   OR NEW.`deleted_at` >= 100000000000)
BEGIN
  SELECT RAISE(ABORT, 'epoch timestamp must be seconds, got milliseconds');
END
--> statement-breakpoint
CREATE TRIGGER `users_ts_unit_guard_update`
BEFORE UPDATE ON `users`
FOR EACH ROW
WHEN (NEW.`created_at` >= 100000000000
   OR NEW.`updated_at` >= 100000000000
   OR NEW.`email_verified_at` >= 100000000000
   OR NEW.`deleted_at` >= 100000000000)
BEGIN
  SELECT RAISE(ABORT, 'epoch timestamp must be seconds, got milliseconds');
END
--> statement-breakpoint
CREATE TRIGGER `search_misses_ts_unit_guard_insert`
BEFORE INSERT ON `search_misses`
FOR EACH ROW
WHEN (NEW.`created_at` >= 100000000000
   OR NEW.`updated_at` >= 100000000000
   OR NEW.`last_searched_at` >= 100000000000
   OR NEW.`deleted_at` >= 100000000000)
BEGIN
  SELECT RAISE(ABORT, 'epoch timestamp must be seconds, got milliseconds');
END
--> statement-breakpoint
CREATE TRIGGER `search_misses_ts_unit_guard_update`
BEFORE UPDATE ON `search_misses`
FOR EACH ROW
WHEN (NEW.`created_at` >= 100000000000
   OR NEW.`updated_at` >= 100000000000
   OR NEW.`last_searched_at` >= 100000000000
   OR NEW.`deleted_at` >= 100000000000)
BEGIN
  SELECT RAISE(ABORT, 'epoch timestamp must be seconds, got milliseconds');
END
--> statement-breakpoint
CREATE TRIGGER `word_card_shares_ts_unit_guard_insert`
BEFORE INSERT ON `word_card_shares`
FOR EACH ROW
WHEN (NEW.`created_at` >= 100000000000)
BEGIN
  SELECT RAISE(ABORT, 'epoch timestamp must be seconds, got milliseconds');
END
--> statement-breakpoint
CREATE TRIGGER `word_card_shares_ts_unit_guard_update`
BEFORE UPDATE ON `word_card_shares`
FOR EACH ROW
WHEN (NEW.`created_at` >= 100000000000)
BEGIN
  SELECT RAISE(ABORT, 'epoch timestamp must be seconds, got milliseconds');
END
--> statement-breakpoint
CREATE TRIGGER `word_edit_suggestions_ts_unit_guard_insert`
BEFORE INSERT ON `word_edit_suggestions`
FOR EACH ROW
WHEN (NEW.`created_at` >= 100000000000
   OR NEW.`updated_at` >= 100000000000
   OR NEW.`reviewed_at` >= 100000000000
   OR NEW.`deleted_at` >= 100000000000)
BEGIN
  SELECT RAISE(ABORT, 'epoch timestamp must be seconds, got milliseconds');
END
--> statement-breakpoint
CREATE TRIGGER `word_edit_suggestions_ts_unit_guard_update`
BEFORE UPDATE ON `word_edit_suggestions`
FOR EACH ROW
WHEN (NEW.`created_at` >= 100000000000
   OR NEW.`updated_at` >= 100000000000
   OR NEW.`reviewed_at` >= 100000000000
   OR NEW.`deleted_at` >= 100000000000)
BEGIN
  SELECT RAISE(ABORT, 'epoch timestamp must be seconds, got milliseconds');
END
