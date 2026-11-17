import { sqliteTable, text, integer, index, uniqueIndex } from 'drizzle-orm/sqlite-core';
import { generateId } from '@/shared/utils/ulid';
import { users } from './users.schema';

/**
 * Snapshot minggu ISO (Senin 00:00 WIB). `finalized_at` null = belum dibekukan.
 * Lihat docs/LEADERBOARD_WEEKLY_PLAN.md.
 */
export const leaderboardWeeks = sqliteTable(
  'leaderboard_weeks',
  {
    id: text('id').primaryKey().$defaultFn(() => generateId()),
    weekId: text('week_id').notNull(),
    startedAt: integer('started_at', { mode: 'timestamp' }).notNull(),
    endedAt: integer('ended_at', { mode: 'timestamp' }).notNull(),
    metric: text('metric').notNull().default('combined'),
    finalizedAt: integer('finalized_at', { mode: 'timestamp' }),
    publishedUrl: text('published_url'),
    /** Touch tiap refresh current.json minggu berjalan. */
    updatedAt: integer('updated_at', { mode: 'timestamp' }),
    createdAt: integer('created_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
    deletedAt: integer('deleted_at', { mode: 'timestamp' }),
    deletedBy: text('deleted_by').references(() => users.id),
  },
  (t) => [
    uniqueIndex('leaderboard_weeks_week_id_unique').on(t.weekId),
    index('leaderboard_weeks_finalized_idx').on(t.finalizedAt),
  ],
);

/** Top-N entri per minggu (snapshot username/avatar saat finalize). */
export const leaderboardWeekEntries = sqliteTable(
  'leaderboard_week_entries',
  {
    id: text('id').primaryKey().$defaultFn(() => generateId()),
    weekId: text('week_id').notNull(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id),
    rank: integer('rank').notNull(),
    username: text('username').notNull(),
    avatarUrl: text('avatar_url'),
    contributions: integer('contributions').notNull(),
    verifications: integer('verifications').notNull(),
    combined: integer('combined').notNull(),
    isVerifier: integer('is_verifier', { mode: 'boolean' }).notNull().default(false),
    createdAt: integer('created_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
  },
  (t) => [
    uniqueIndex('leaderboard_week_entries_week_user_unique').on(t.weekId, t.userId),
    index('leaderboard_week_entries_week_idx').on(t.weekId),
    index('leaderboard_week_entries_user_idx').on(t.userId),
    index('leaderboard_week_entries_rank_idx').on(t.weekId, t.rank),
  ],
);
