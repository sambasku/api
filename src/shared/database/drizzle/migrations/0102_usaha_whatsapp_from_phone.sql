-- Gabung telepon + WhatsApp jadi satu nomor HP.
-- Form usulan usaha kini hanya punya satu field "No. HP"; backend mengisi
-- whatsapp dari phone saat kosong (lihat toNewPayload controller). Backfill:
-- isi whatsapp yang kosong dari phone untuk data lama.

UPDATE usahas
SET whatsapp = phone
WHERE (whatsapp IS NULL OR trim(whatsapp) = '')
  AND phone IS NOT NULL
  AND trim(phone) <> '';
--> statement-breakpoint
-- `usaha_contributions` tidak punya kolom phone/whatsapp: keduanya tersimpan
-- di dalam `payload_json`, jadi backfill lewat json_set (json1).
UPDATE usaha_contributions
SET payload_json = json_set(
  payload_json,
  '$.whatsapp',
  json_extract(payload_json, '$.phone')
)
WHERE json_extract(payload_json, '$.phone') IS NOT NULL
  AND trim(json_extract(payload_json, '$.phone')) <> ''
  AND (
    json_extract(payload_json, '$.whatsapp') IS NULL
    OR trim(json_extract(payload_json, '$.whatsapp')) = ''
  );
