import {
  index,
  integer,
  primaryKey,
  sqliteTable,
  text,
} from 'drizzle-orm/sqlite-core';
import { layanans } from './layanans.schema';

/**
 * Viewer unik yang membuka detail layanan publik per hari WIB
 * (docs/api/64-api-layanan-views.md).
 *
 * Satu baris per (layanan, hari WIB, viewer). PK + ON CONFLICT DO NOTHING.
 */
export const layananViews = sqliteTable(
  'layanan_views',
  {
    layananId: text('layanan_id')
      .notNull()
      .references(() => layanans.id),
    day: text('day').notNull(),
    viewerKey: text('viewer_key').notNull(),
    count: integer('count').notNull().default(1),
  },
  (t) => [
    primaryKey({ columns: [t.layananId, t.day, t.viewerKey] }),
    index('layanan_views_day_idx').on(t.day),
  ],
);