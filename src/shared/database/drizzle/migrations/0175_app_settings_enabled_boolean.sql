-- Kill switch / flag `*_enabled`: tipe boolean seragam (Console Select Aktif/Nonaktif).
-- Seed idempotent + perbaiki baris lama yang sempat tersimpan sebagai string.
INSERT OR IGNORE INTO `app_settings` (`key`, `value`, `type`, `description`, `updated_at`) VALUES
	('streak_reminder_enabled', 'false', 'boolean', 'Kill switch pengingat streak/leveling. false = cron tidak kirim.', unixepoch() * 1000),
	('auto_verify_by_vote_enabled', 'false', 'boolean', 'Auto-verif makna oleh Voting Warga saat quorum vote tercapai. Default off sampai G2 live.', unixepoch() * 1000),
	('search_miss_auto_visible_enabled', 'false', 'boolean', 'Search miss baru auto is_visible bila lolos blocklist/quality. Default off sampai G3 live.', unixepoch() * 1000),
	('vote_reset_on_edit_enabled', 'false', 'boolean', 'Reset vote + archive saat usulan/edit verifikator mengubah makna. Default off sampai G2b live.', unixepoch() * 1000);--> statement-breakpoint
UPDATE `app_settings` SET `type` = 'boolean' WHERE `key` IN (
	'wa.verifier_enabled',
	'streak_reminder_enabled',
	'voice.room_enabled',
	'auto_verify_by_vote_enabled',
	'search_miss_auto_visible_enabled',
	'vote_reset_on_edit_enabled'
);--> statement-breakpoint
UPDATE `app_settings` SET `description` = 'Auto-verif makna oleh Voting Warga saat quorum vote tercapai. Default off sampai G2 live.'
	WHERE `key` = 'auto_verify_by_vote_enabled' AND (`description` IS NULL OR `description` = '');--> statement-breakpoint
UPDATE `app_settings` SET `description` = 'Search miss baru auto is_visible bila lolos blocklist/quality. Default off sampai G3 live.'
	WHERE `key` = 'search_miss_auto_visible_enabled' AND (`description` IS NULL OR `description` = '');--> statement-breakpoint
UPDATE `app_settings` SET `description` = 'Reset vote + archive saat usulan/edit verifikator mengubah makna. Default off sampai G2b live.'
	WHERE `key` = 'vote_reset_on_edit_enabled' AND (`description` IS NULL OR `description` = '');--> statement-breakpoint
UPDATE `app_settings` SET `description` = 'Kill switch pengingat streak/leveling. false = cron tidak kirim.'
	WHERE `key` = 'streak_reminder_enabled' AND (`description` IS NULL OR `description` = '');
