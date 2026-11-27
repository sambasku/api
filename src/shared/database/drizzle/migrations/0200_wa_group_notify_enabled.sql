-- Master switch semua pesan WA keluar (grup, verifikator, Baleho). Default off.
-- Idempotent: INSERT OR IGNORE tidak menimpa nilai yang sudah diubah admin.
INSERT OR IGNORE INTO `app_settings` (`key`, `value`, `type`, `description`, `updated_at`) VALUES
	('wa_group_notify_enabled', 'false', 'boolean', 'Master switch semua pesan WA keluar (grup, verifikator, Baleho). false = semua di-skip. Test send admin tetap jalan.', unixepoch() * 1000);
