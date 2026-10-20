-- Ringkasan jumlah vote kata (0084 rows-read): deck vote mengurutkan
-- total_votes ASC. Sebelumnya COUNT(*) correlated per kata published =
-- scan seluruh tabel votes per request. Tabel ringkasan = rekomendasi
-- Turso untuk agregat (docs usage-and-billing).
--
-- total = JUMLAH baris vote (up + down) untuk target entity_type='word',
-- sesuai definisi lama "upvotes + downvotes" di 34-api-vote-deck.md.
CREATE TABLE `word_vote_counts` (
`word_id` text PRIMARY KEY NOT NULL,
`total` integer NOT NULL DEFAULT 0,
`updated_at` integer NOT NULL,
FOREIGN KEY (`word_id`) REFERENCES `words`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `word_vote_counts_total_idx` ON `word_vote_counts` (`total`,`word_id`);
--> statement-breakpoint
INSERT INTO `word_vote_counts` (`word_id`, `total`, `updated_at`)
SELECT `entity_id`, COUNT(*), unixepoch()
FROM `votes`
WHERE `entity_type` = 'word'
GROUP BY `entity_id`;
