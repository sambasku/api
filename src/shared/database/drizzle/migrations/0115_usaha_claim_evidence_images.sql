-- Bukti klaim multi-gambar (ImageKit, privat). Klaim baru wajib 1-5 gambar;
-- contact_evidence boleh string kosong (legacy teks tetap didukung).
ALTER TABLE `usaha_claims` ADD `evidence_images` text DEFAULT '[]' NOT NULL;
