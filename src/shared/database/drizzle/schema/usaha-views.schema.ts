import {
  sqliteTable,
  text,
  integer,
  primaryKey,
  index,
} from 'drizzle-orm/sqlite-core';
import { usahas } from './usahas.schema';

/**
 * Viewer unik yang membuka detail usaha per hari WIB (docs/api/60-api-usaha-views.md).
 *
 * Satu baris per (usaha, hari WIB, viewer). PK + ON CONFLICT DO NOTHING.
 */
export const usahaViews = sqliteTable(
  'usaha_views',
  {
    usahaId: text('usaha_id')
      .notNull()
      .references(() => usahas.id),
    day: text('day').notNull(),
    viewerKey: text('viewer_key').notNull(),
    count: integer('count').notNull().default(1),
  },
  (t) => [
    primaryKey({ columns: [t.usahaId, t.day, t.viewerKey] }),
    index('usaha_views_day_idx').on(t.day),
  ],
);