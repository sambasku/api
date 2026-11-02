import { sqliteTable, text, integer, index } from 'drizzle-orm/sqlite-core';
import { meanings } from './meanings.schema';

/**
 * Ringkasan jumlah vote makna: antrean deck vote per makna urut
 * `total_votes ASC` (jumlah baris vote, up + down). `COUNT(*)` correlated
 * per makna published = scan besar per request; tabel ini menggantinya
 * (rekomendasi Turso untuk agregat, docs usage-and-billing).
 *
 * Dipertahankan di transaksi tulis vote yang sama (vote.repository):
 * insert vote makna -> +1, delete -> -1, ganti arah (upsert) -> tetap.
 */
export const meaningVoteCounts = sqliteTable(
  'meaning_vote_counts',
  {
    meaningId: text('meaning_id')
      .primaryKey()
      .references(() => meanings.id),
    total: integer('total').notNull().default(0),
    updatedAt: integer('updated_at', { mode: 'timestamp' })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (t) => [
    // Deck: ORDER BY total ASC, meaning_id ASC - keyset memakai index ini.
    index('meaning_vote_counts_total_idx').on(t.total, t.meaningId),
  ],
);
