INSERT INTO `app_settings` (`key`, `value`, `updated_at`, `updated_by`) VALUES
	-- Default 'lenient': app versi lama (tanpa consents) tetap bisa daftar
	-- via OAuth. Flip ke 'enforce' via console setelah rollout app baru
	-- selesai. Lihat docs/api/44-api-consent-oauth.md.
	('legal.oauth_consent_enforcement', 'lenient', unixepoch() * 1000, NULL);
