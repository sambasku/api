-- Self-declare penutur asli vs pembelajar bahasa Sambas (mobile#258).
-- native = penutur asli; learner = sedang belajar; NULL = belum diisi.
ALTER TABLE `users` ADD `speaker_status` text;
--> statement-breakpoint
CREATE INDEX `users_speaker_status_idx` ON `users` (`speaker_status`);
