import { sqliteTable, text, integer, index } from 'drizzle-orm/sqlite-core';
import { words } from './words.schema';

/**
 * Ringkasan jumlah vote kata (0083 rows-read): antrean deck vote perlu
 * urut `total_votes ASC` (jumlah baris vote, up + down). `COUNT(*)`
 * correlated per kata published = scan 45k baris per request; tabel ini
 * menggantinya (rekomendasi Turso untuk agregat, docs usage-and-billing).
 *
 * Dipertahankan di transaksi tulis vote yang sama (vote.repository):
 * insert vote word -> +1, delete -> -1, ganti arah (upsert) -> tetap.
 */
export const wordVoteCounts = sqliteTable(
  'word_vote_counts',
  {
    wordId: text('word_id')
      .primaryKey()
      .references(() => words.id),
    total: integer('total').notNull().default(0),
    updatedAt: integer('updated_at', { mode: 'timestamp' })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (t) => [
    // Deck: ORDER BY total ASC, word_id ASC - keyset memakai index ini.
    index('word_vote_counts_total_idx').on(t.total, t.wordId),
  ],
);
