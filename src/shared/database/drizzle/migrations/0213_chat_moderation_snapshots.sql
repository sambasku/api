-- Migration 0213: salinan moderasi chat (admin-only) untuk pesan yang dihapus.
-- Diisi saat tombstone, sebelum body di-null-kan dan revisi dipurge.
-- Pengguna tidak pernah membaca tabel ini; hanya endpoint admin moderasi.
CREATE TABLE `chat_message_moderation_snapshots` (
	`id` text PRIMARY KEY NOT NULL,
	`message_id` text NOT NULL,
	`user_id` text NOT NULL,
	`username` text,
	`display_name` text,
	`kind` text NOT NULL,
	`body` text,
	`sticker_id` text,
	`reply_to_id` text,
	`reply_snippet` text,
	`revisions_json` text NOT NULL,
	`message_created_at` integer NOT NULL,
	`deleted_at` integer NOT NULL,
	`deleted_by` text NOT NULL,
	`deletion_reason` text,
	`snapshot_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `chat_moderation_snapshots_message_uidx` ON `chat_message_moderation_snapshots` (`message_id`);
