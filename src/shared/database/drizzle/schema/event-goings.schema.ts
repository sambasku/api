import {
  index,
  integer,
  sqliteTable,
  text,
  uniqueIndex,
} from 'drizzle-orm/sqlite-core';
import { generateId } from '@/shared/utils/ulid';
import { users } from './users.schema';
import { events } from './events.schema';

/**
 * Soft RSVP "berencana datang" per user per acara.
 * Batal = hard delete baris (preseden bookmarks/votes: user-state tanpa deleted_at).
 */
export const eventGoings = sqliteTable(
  'event_goings',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => generateId()),
    eventId: text('event_id')
      .notNull()
      .references(() => events.id, { onDelete: 'cascade' }),
    userId: text('user_id')
      .notNull()
      .references(() => users.id),
    createdAt: integer('created_at', { mode: 'timestamp' })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (t) => [
    uniqueIndex('event_goings_user_event_uidx').on(t.userId, t.eventId),
    index('event_goings_event_idx').on(t.eventId, t.createdAt, t.id),
    index('event_goings_user_idx').on(t.userId, t.id),
  ],
);
