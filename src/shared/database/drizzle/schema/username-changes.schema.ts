import { sql } from 'drizzle-orm';
import { index, integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';
import { generateId } from '@/shared/utils/ulid';
import { users } from './users.schema';

/**
 * Riwayat ganti username + hold handle lama (mobile#257).
 * Hold aktif: released_at IS NULL AND hold_until > now.
 */
export const usernameChanges = sqliteTable(
  'username_changes',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => generateId()),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    oldUsername: text('old_username').notNull(),
    newUsername: text('new_username').notNull(),
    changedAt: integer('changed_at', { mode: 'timestamp' }).notNull(),
    holdUntil: integer('hold_until', { mode: 'timestamp' }).notNull(),
    /** Diisi saat reclaim / soft-delete / lepas hold eksplisit. */
    releasedAt: integer('released_at', { mode: 'timestamp' }),
  },
  (t) => [
    index('username_changes_user_changed_idx').on(t.userId, t.changedAt),
    index('username_changes_old_username_idx').on(t.oldUsername),
    index('username_changes_active_hold_idx')
      .on(t.oldUsername)
      .where(sql`released_at is null`),
  ],
);
