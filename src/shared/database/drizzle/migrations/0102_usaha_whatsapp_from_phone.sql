-- Gabung telepon + WhatsApp jadi satu nomor HP.
-- Form usulan usaha kini hanya punya satu field "No. HP"; backend mengisi
-- whatsapp dari phone saat kosong (lihat toNewPayload controller). Backfill:
-- isi whatsapp yang kosong dari phone untuk data lama.

UPDATE usahas
SET whatsapp = phone
WHERE (whatsapp IS NULL OR trim(whatsapp) = '')
  AND phone IS NOT NULL
  AND trim(phone) <> '';

UPDATE usaha_contributions
SET whatsapp = phone
WHERE (whatsapp IS NULL OR trim(whatsapp) = '')
  AND phone IS NOT NULL
  AND trim(phone) <> '';
