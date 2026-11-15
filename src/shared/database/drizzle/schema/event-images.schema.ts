import {
  index,
  integer,
  sqliteTable,
  text,
} from 'drizzle-orm/sqlite-core';
import { generateId } from '@/shared/utils/ulid';
import { events } from './events.schema';

/**
 * Galeri foto acara (user-generated, pola place_images #187).
 * Takedown admin = set hidden_at (soft-hide, berkas tetap di CDN).
 */
export const eventImages = sqliteTable(
  'event_images',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => generateId()),
    eventId: text('event_id')
      .notNull()
      .references(() => events.id, { onDelete: 'cascade' }),
    url: text('url').notNull(),
    attributionJson: text('attribution_json'),
    createdAt: integer('created_at', { mode: 'timestamp' })
      .notNull()
      .$defaultFn(() => new Date()),
    /** Non-null = foto tak tampil di publik (takedown admin). */
    hiddenAt: integer('hidden_at', { mode: 'timestamp' }),
  },
  (t) => [index('event_images_event_id_idx').on(t.eventId)],
);
