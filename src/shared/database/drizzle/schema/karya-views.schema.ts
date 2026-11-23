import {
  index,
  integer,
  primaryKey,
  sqliteTable,
  text,
} from 'drizzle-orm/sqlite-core';
import { karyas } from './karyas.schema';

/**
 * Viewer unik yang membuka detail karya per hari WIB (docs/api/63-api-karya-views.md).
 *
 * Satu baris per (karya, hari WIB, viewer). PK + ON CONFLICT DO NOTHING.
 */
export const karyaViews = sqliteTable(
  'karya_views',
  {
    karyaId: text('karya_id')
      .notNull()
      .references(() => karyas.id),
    day: text('day').notNull(),
    viewerKey: text('viewer_key').notNull(),
    count: integer('count').notNull().default(1),
  },
  (t) => [
    primaryKey({ columns: [t.karyaId, t.day, t.viewerKey] }),
    index('karya_views_day_idx').on(t.day),
  ],
);