import { sqliteTable, text, integer, index } from 'drizzle-orm/sqlite-core';
import { words } from './words.schema';

/**
 * Siklus tampil & cooldown Top 10 tab HITS / Terpopuler (`viewed`) di
 * GET /api/v1/hot-topics (#372).
 *
 * Saat kata masuk Top 10, cron mencatat `entered_at`:
 * - aktif tayang: `now < expires_at` (default 24 jam)
 * - cooldown: `expires_at <= now < cooldown_until` (default 24 jam setelah expired)
 * - selesai: `now >= cooldown_until` (dihapus cron, boleh masuk siklus baru)
 */
export const hotViewedSlots = sqliteTable(
  'hot_viewed_slots',
  {
    wordId: text('word_id')
      .primaryKey()
      .references(() => words.id, { onDelete: 'cascade' }),
    enteredAt: integer('entered_at', { mode: 'timestamp' }).notNull(),
    expiresAt: integer('expires_at', { mode: 'timestamp' }).notNull(),
    cooldownUntil: integer('cooldown_until', { mode: 'timestamp' }).notNull(),
    updatedAt: integer('updated_at', { mode: 'timestamp' })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (t) => [index('hot_viewed_slots_cooldown_idx').on(t.cooldownUntil)],
);
