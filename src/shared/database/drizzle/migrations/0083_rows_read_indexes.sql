-- Optimasi rows read Turso (audit 2026-10-21): hot path publik yang scan
-- penuh + TEMP B-TREE sort karena tidak ada index yang cocok.
--
-- 1) Browse A-Z + panel huruf (listAtoZ): ORDER BY lower(lemma), id dengan
--    filter status='published'. Sebelumnya pakai words_published_recent_idx
--    (status) lalu TEMP B-TREE sort = baca semua baris published per halaman.
-- 2) Feed beranda (listLatest): ORDER BY COALESCE(verified_at, created_at)
--    DESC - ekspresi tidak tertutup index mana pun.
-- 3) Cek fulfilled search-miss: lookup lower(trim(form)) /
--    lower(trim(translation_text)) tanpa index = full scan per term.
-- Catatan biaya: CREATE INDEX = one-time full scan charge (docs Turso
-- usage-and-billing); ditukar dengan penghematan per-request permanen.
CREATE INDEX `words_status_az_idx` ON `words` (`status`,lower("lemma"),`id`);
--> statement-breakpoint
CREATE INDEX `words_published_approved_idx` ON `words` (`status`,coalesce("verified_at","created_at"),`id`);
--> statement-breakpoint
CREATE INDEX `word_variants_form_trim_idx` ON `word_variants` (lower(trim("form")),`word_id`) WHERE word_variants."deleted_at" IS NULL;
--> statement-breakpoint
CREATE INDEX `meaning_translations_text_trim_idx` ON `meaning_translations` (lower(trim("translation_text")),`meaning_id`) WHERE meaning_translations."deleted_at" IS NULL;
