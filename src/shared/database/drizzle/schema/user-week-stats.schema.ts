import { sqliteTable, text, integer, index, uniqueIndex } from 'drizzle-orm/sqlite-core';
import { generateId } from '@/shared/utils/ulid';
import { users } from './users.schema';

/**
 * Riwayat poin mingguan per user (snapshot saat finalize leaderboard).
 * Membekukan skor 5/3/2/2 + total XP leveling saat minggu berakhir,
 * supaya pergerakan poin/XP transparan dan tidak dihitung ulang read-time.
 * Lihat docs/api/31-api-leaderboard.md.
 */
export const userWeekStats = sqliteTable(
  'user_week_stats',
  {
    id: text('id').primaryKey().$defaultFn(() => generateId()),
    userId: text('user_id')
      .notNull()
      .references(() => users.id),
    weekId: text('week_id').notNull(),
    submittedPoints: integer('submitted_points').notNull().default(0),
    approvedPoints: integer('approved_points').notNull().default(0),
    verificationPoints: integer('verification_points').notNull().default(0),
    combined: integer('combined').notNull().default(0),
    /** Total poin leveling (derived) saat minggu berakhir. */
    xpAtWeekEnd: integer('xp_at_week_end').notNull().default(0),
    createdAt: integer('created_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
  },
  (t) => [
    uniqueIndex('user_week_stats_user_week_unique').on(t.userId, t.weekId),
    index('user_week_stats_week_idx').on(t.weekId),
    index('user_week_stats_user_idx').on(t.userId),
  ],
);
