import {
  index,
  integer,
  sqliteTable,
  text,
  uniqueIndex,
} from 'drizzle-orm/sqlite-core';
import { generateId } from '@/shared/utils/ulid';
import { users } from './users.schema';
import { places } from './places.schema';

/**
 * Soft RSVP "berencana kunjung" per user per wisata.
 * Batal = hard delete baris (preseden bookmarks/votes: user-state tanpa deleted_at).
 */
export const placeVisits = sqliteTable(
  'place_visits',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => generateId()),
    placeId: text('place_id')
      .notNull()
      .references(() => places.id, { onDelete: 'cascade' }),
    userId: text('user_id')
      .notNull()
      .references(() => users.id),
    createdAt: integer('created_at', { mode: 'timestamp' })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (t) => [
    uniqueIndex('place_visits_user_place_uidx').on(t.userId, t.placeId),
    index('place_visits_place_idx').on(t.placeId, t.createdAt, t.id),
    index('place_visits_user_idx').on(t.userId, t.id),
  ],
);