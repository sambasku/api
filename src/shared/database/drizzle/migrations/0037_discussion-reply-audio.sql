-- Balasan Ruang Diskusi: lampiran audio (GitHub sambasku/audios).
-- Voice-only: body tetap NOT NULL, isi string kosong.
ALTER TABLE `discussion_replies` ADD `audio_url` text;--> statement-breakpoint
ALTER TABLE `discussion_replies` ADD `audio_mime_type` text;--> statement-breakpoint
ALTER TABLE `discussion_replies` ADD `audio_file_size` integer;--> statement-breakpoint
ALTER TABLE `discussion_replies` ADD `audio_duration_ms` integer;--> statement-breakpoint
ALTER TABLE `discussion_replies` ADD `audio_provider` text;--> statement-breakpoint
ALTER TABLE `discussion_replies` ADD `audio_provider_file_id` text;--> statement-breakpoint
ALTER TABLE `discussion_replies` ADD `audio_sha` text;
