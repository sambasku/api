-- Pantun + balasan: lampiran audio bacaan (GitHub sambasku/audios).
-- Teks 4 baris tetap wajib; audio opsional (durasi 10-60s di aplikasi).
ALTER TABLE `pantuns` ADD `audio_url` text;--> statement-breakpoint
ALTER TABLE `pantuns` ADD `audio_mime_type` text;--> statement-breakpoint
ALTER TABLE `pantuns` ADD `audio_file_size` integer;--> statement-breakpoint
ALTER TABLE `pantuns` ADD `audio_duration_ms` integer;--> statement-breakpoint
ALTER TABLE `pantuns` ADD `audio_provider` text;--> statement-breakpoint
ALTER TABLE `pantuns` ADD `audio_provider_file_id` text;--> statement-breakpoint
ALTER TABLE `pantuns` ADD `audio_sha` text;--> statement-breakpoint
ALTER TABLE `pantun_replies` ADD `audio_url` text;--> statement-breakpoint
ALTER TABLE `pantun_replies` ADD `audio_mime_type` text;--> statement-breakpoint
ALTER TABLE `pantun_replies` ADD `audio_file_size` integer;--> statement-breakpoint
ALTER TABLE `pantun_replies` ADD `audio_duration_ms` integer;--> statement-breakpoint
ALTER TABLE `pantun_replies` ADD `audio_provider` text;--> statement-breakpoint
ALTER TABLE `pantun_replies` ADD `audio_provider_file_id` text;--> statement-breakpoint
ALTER TABLE `pantun_replies` ADD `audio_sha` text;
