-- 0064: Konsolidasi feed verifikasi (#56).
-- superseded_at: event usulan (contribution_submitted/word_created) yang
-- ceritanya sudah digantikan event verifikasi lanjutan utk kata yang sama.
-- Bukan hidden/delete - audit + profil (riwayat kontributor) tetap muat.
ALTER TABLE activity_events ADD COLUMN superseded_at integer;
