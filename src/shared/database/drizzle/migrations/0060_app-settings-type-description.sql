-- Kolom type & description untuk app_settings agar UI konfigurasi tidak ambigu.
ALTER TABLE `app_settings` ADD COLUMN `type` text NOT NULL DEFAULT 'string';--> statement-breakpoint
ALTER TABLE `app_settings` ADD COLUMN `description` text;--> statement-breakpoint
UPDATE `app_settings` SET `type` = 'boolean', `description` = 'Aktifkan notifikasi WA saat aplikasi verifikator disetujui/ditolak' WHERE `key` = 'wa.verifier_enabled';--> statement-breakpoint
UPDATE `app_settings` SET `type` = 'url', `description` = 'Link undang grup WhatsApp yang ditambahkan di pesan notifikasi verifikator' WHERE `key` = 'wa.group_cta_url';--> statement-breakpoint
UPDATE `app_settings` SET `type` = 'string', `description` = 'Versi aktif dokumen Syarat & Ketentuan (diisi otomatis saat publish)' WHERE `key` = 'legal.terms_version';--> statement-breakpoint
UPDATE `app_settings` SET `type` = 'string', `description` = 'Versi aktif dokumen Kebijakan Privasi (diisi otomatis saat publish)' WHERE `key` = 'legal.privacy_version';--> statement-breakpoint
UPDATE `app_settings` SET `type` = 'string', `description` = 'Mode registrasi OAuth pihak ketiga: open | closed' WHERE `key` = 'oauth.third_party_registration';--> statement-breakpoint
UPDATE `app_settings` SET `type` = 'number', `description` = 'Retensi log request OAuth dalam hari (1-3650)' WHERE `key` = 'oauth.request_log_retention_days';--> statement-breakpoint
UPDATE `app_settings` SET `type` = 'number', `description` = 'Jeda push saat kontribusi review disetujui (menit, 0 = mati)' WHERE `key` = 'notification.review_approve_push_cooldown_minutes';--> statement-breakpoint
UPDATE `app_settings` SET `type` = 'number', `description` = 'Jeda push saat kontribusi review ditolak (menit, 0 = mati)' WHERE `key` = 'notification.review_reject_push_cooldown_minutes';--> statement-breakpoint
UPDATE `app_settings` SET `type` = 'number', `description` = 'Jeda push komentar diskusi (menit, 0 = mati)' WHERE `key` = 'notification.word_comment_push_cooldown_minutes';--> statement-breakpoint
UPDATE `app_settings` SET `type` = 'number', `description` = 'Jeda push vote kosakata (menit, 0 = mati)' WHERE `key` = 'notification.word_vote_push_cooldown_minutes';--> statement-breakpoint
-- Seed wa.* (belum ada barisnya; INSERT OR IGNORE idempotent).
INSERT OR IGNORE INTO `app_settings` (`key`, `value`, `type`, `description`, `updated_at`) VALUES
	('wa.verifier_enabled', 'false', 'boolean', 'Aktifkan notifikasi WA saat aplikasi verifikator disetujui/ditolak', unixepoch() * 1000),
	('wa.group_cta_url', 'https://chat.whatsapp.com/Kw64lxFEGXfK5gw6T6GEoN?mode=gi_t', 'url', 'Link undang grup WhatsApp yang ditambahkan di pesan notifikasi verifikator', unixepoch() * 1000);