-- Tambah kolom display_name ke leaderboard_week_entries agar tile mobile menampilkan nama tampilan (bukan username).
-- NULL di snapshot lama = fallback ke username di wire mobile.
ALTER TABLE leaderboard_week_entries ADD COLUMN display_name TEXT;
