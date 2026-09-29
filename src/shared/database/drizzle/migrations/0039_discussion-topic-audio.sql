-- Audio opsional pada opening thread Ruang Diskusi (GitHub sambasku/audios).
-- Redact di wire publik sampai status published.
ALTER TABLE `discussions` ADD `audio_url` text;--> statement-breakpoint
ALTER TABLE `discussions` ADD `audio_mime_type` text;--> statement-breakpoint
ALTER TABLE `discussions` ADD `audio_file_size` integer;--> statement-breakpoint
ALTER TABLE `discussions` ADD `audio_duration_ms` integer;--> statement-breakpoint
ALTER TABLE `discussions` ADD `audio_provider` text;--> statement-breakpoint
ALTER TABLE `discussions` ADD `audio_provider_file_id` text;--> statement-breakpoint
ALTER TABLE `discussions` ADD `audio_sha` text;
