CREATE TABLE `wa_message_templates` (
	`id` text PRIMARY KEY NOT NULL,
	`event_key` text NOT NULL,
	`enabled` integer DEFAULT 0 NOT NULL,
	`meta_template_name` text NOT NULL,
	`meta_template_language` text DEFAULT 'id' NOT NULL,
	`body` text NOT NULL,
	`params` text DEFAULT '[]' NOT NULL,
	`updated_at` integer,
	`updated_by` text,
	FOREIGN KEY (`updated_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `wa_message_templates_event_key_unique` ON `wa_message_templates` (`event_key`);
--> statement-breakpoint
CREATE TABLE `wa_message_logs` (
	`id` text PRIMARY KEY NOT NULL,
	`provider` text NOT NULL,
	`event_key` text NOT NULL,
	`to_phone` text NOT NULL,
	`template_name` text,
	`channel` text NOT NULL,
	`status` text NOT NULL,
	`error_message` text,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `wa_message_logs_created_at_idx` ON `wa_message_logs` (`created_at`);
--> statement-breakpoint
CREATE TABLE `wa_usage` (
	`provider` text PRIMARY KEY NOT NULL,
	`used_count` integer DEFAULT 0 NOT NULL,
	`limit_count` integer DEFAULT 2000 NOT NULL,
	`warn_threshold_percent` integer DEFAULT 80 NOT NULL,
	`period_start` integer NOT NULL,
	`updated_at` integer,
	`updated_by` text,
	FOREIGN KEY (`updated_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
-- Seed: 2 event verifikator + usage kapso (free tier 2000, terpakai ±10).
INSERT INTO `wa_message_templates` (`id`, `event_key`, `enabled`, `meta_template_name`, `meta_template_language`, `body`, `params`, `updated_at`)
VALUES (
	'wa_tpl_verifier_approved',
	'verifier_application_approved',
	0,
	'verifier_approved',
	'id',
	'Selamat {{displayName}}, pengajuan kamu sebagai verifikator SambasKu disetujui!

Manfaat jadi verifikator:
{{benefits}}

Yuk gabung grup WhatsApp SambasKu untuk diskusi dan silaturahmi: {{ctaUrl}}

Keluar lalu masuk lagi di aplikasi biar peran Verifikator aktif.',
	'[{"name":"displayName","description":"Nama tampilan pemohon"},{"name":"benefits","description":"Daftar manfaat menjadi verifikator"},{"name":"ctaUrl","description":"Link grup WA (app setting wa.group_cta_url)"}]',
	unixepoch() * 1000
),
(
	'wa_tpl_verifier_rejected',
	'verifier_application_rejected',
	0,
	'verifier_rejected',
	'id',
	'Hai {{displayName}}, pengajuan kamu sebagai verifikator SambasKu belum bisa kami setujui.

Alasan: {{reasonRejected}}

Silakan perbaiki lalu ajukan kembali ya. Gabung juga grup WA SambasKu untuk diskusi dan silaturahmi: {{ctaUrl}}',
	'[{"name":"displayName","description":"Nama tampilan pemohon"},{"name":"reasonRejected","description":"Alasan penolakan dari admin"},{"name":"ctaUrl","description":"Link grup WA (app setting wa.group_cta_url)"}]',
	unixepoch() * 1000
);
--> statement-breakpoint
INSERT INTO `wa_usage` (`provider`, `used_count`, `limit_count`, `warn_threshold_percent`, `period_start`)
VALUES ('kapso', 10, 2000, 80, unixepoch() * 1000);
