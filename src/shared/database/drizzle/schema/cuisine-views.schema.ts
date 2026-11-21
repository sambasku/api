import {
  sqliteTable,
  text,
  integer,
  primaryKey,
  index,
} from 'drizzle-orm/sqlite-core';
import { cuisines } from './cuisines.schema';

/**
 * Viewer unik yang membuka detail kuliner per hari WIB (docs/api/61-api-cuisine-views.md).
 */
export const cuisineViews = sqliteTable(
  'cuisine_views',
  {
    cuisineId: text('cuisine_id')
      .notNull()
      .references(() => cuisines.id),
    day: text('day').notNull(),
    viewerKey: text('viewer_key').notNull(),
    count: integer('count').notNull().default(1),
  },
  (t) => [
    primaryKey({ columns: [t.cuisineId, t.day, t.viewerKey] }),
    index('cuisine_views_day_idx').on(t.day),
  ],
);