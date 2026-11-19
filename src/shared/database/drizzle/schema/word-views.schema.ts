import {
  sqliteTable,
  text,
  integer,
  primaryKey,
  index,
} from 'drizzle-orm/sqlite-core';
import { words } from './words.schema';

/**
 * Viewer unik yang membuka detail lemma per hari - metrik popularitas
 * (docs/api/59-api-word-views.md, G6 trust-makna-hot-loop).
 *
 * Satu baris per (word, hari WIB, viewer). Pola sama place_views:
 * - `u:<user_id>` | `d:<device_id>` | `ip:<ip>`
 * PK tiga kolom + ON CONFLICT DO NOTHING = 1 pembaca / lemma / hari.
 */
export const wordViews = sqliteTable(
  'word_views',
  {
    wordId: text('word_id')
      .notNull()
      .references(() => words.id),
    day: text('day').notNull(), // 'YYYY-MM-DD' WIB
    viewerKey: text('viewer_key').notNull(),
    /** Selalu 1 - jumlah = COUNT baris. */
    count: integer('count').notNull().default(1),
  },
  (t) => [
    primaryKey({ columns: [t.wordId, t.day, t.viewerKey] }),
    index('word_views_day_idx').on(t.day),
  ],
);
