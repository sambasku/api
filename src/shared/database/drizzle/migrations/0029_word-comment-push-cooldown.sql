INSERT INTO `app_settings` (`key`, `value`, `updated_at`, `updated_by`) VALUES
	('notification.word_comment_push_cooldown_minutes', '3', unixepoch() * 1000, NULL)
ON CONFLICT(`key`) DO NOTHING;
