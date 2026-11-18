import {
  index,
  integer,
  sqliteTable,
  text,
  uniqueIndex,
} from 'drizzle-orm/sqlite-core';
import { generateId } from '@/shared/utils/ulid';
import { users } from './users.schema';
import { usahas } from './usahas.schema';

/**
 * Soft RSVP "berencana kunjung" per user per usaha.
 * Batal = hard delete baris (preseden bookmarks/votes: user-state tanpa deleted_at).
 */
export const usahaVisits = sqliteTable(
  'usaha_visits',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => generateId()),
    usahaId: text('usaha_id')
      .notNull()
      .references(() => usahas.id, { onDelete: 'cascade' }),
    userId: text('user_id')
      .notNull()
      .references(() => users.id),
    createdAt: integer('created_at', { mode: 'timestamp' })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (t) => [
    uniqueIndex('usaha_visits_user_usaha_uidx').on(t.userId, t.usahaId),
    index('usaha_visits_usaha_idx').on(t.usahaId, t.createdAt, t.id),
    index('usaha_visits_user_idx').on(t.userId, t.id),
  ],
);