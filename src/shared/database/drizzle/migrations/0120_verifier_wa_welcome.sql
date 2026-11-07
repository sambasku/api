-- Ucapan selamat bergabung tim verifikator + tautan grup Pojok SambasKu.
UPDATE `wa_message_templates`
SET
  `body` = 'Selamat {{displayName}}, kamu bergabung menjadi tim verifikator SambasKu.

Gabung grup WhatsApp Pojok SambasKu:
{{ctaUrl}}

Keluar lalu masuk lagi di aplikasi biar peran Verifikator aktif.',
  `params` = '[{"name":"displayName","description":"Nama tampilan pemohon"},{"name":"ctaUrl","description":"Link grup WA (app setting wa.group_cta_url)"}]',
  `enabled` = 1,
  `updated_at` = unixepoch() * 1000
WHERE `event_key` = 'verifier_application_approved';
--> statement-breakpoint
UPDATE `app_settings`
SET
  `value` = 'https://chat.whatsapp.com/Kw64lxFEGXfK5gw6T6GEoN?mode=gi_t&utm_source=sambasku.com&utm_medium=referral',
  `updated_at` = unixepoch() * 1000
WHERE `key` = 'wa.group_cta_url'
  AND `value` = 'https://chat.whatsapp.com/Kw64lxFEGXfK5gw6T6GEoN?mode=gi_t';
