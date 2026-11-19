-- Trust per makna: atribusi verifikasi + flag needs_review (Hot loop G1).
-- Data lama: is_verified tetap apa adanya; verified_by/at null; needs_review false.

ALTER TABLE `meanings` ADD COLUMN `verified_by` text REFERENCES `users`(`id`);--> statement-breakpoint
ALTER TABLE `meanings` ADD COLUMN `verified_at` integer;--> statement-breakpoint
ALTER TABLE `meanings` ADD COLUMN `needs_review` integer NOT NULL DEFAULT 0;--> statement-breakpoint
CREATE INDEX `meanings_needs_review_idx` ON `meanings` (`needs_review`, `word_id`);
