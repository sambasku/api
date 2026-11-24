import { sql } from 'drizzle-orm';
import {
  index,
  integer,
  sqliteTable,
  text,
  uniqueIndex,
} from 'drizzle-orm/sqlite-core';

/** Cover global profil: tab Profil (hero) vs profil publik (compact). */
export const profileCovers = sqliteTable(
  'profile_covers',
  {
    id: text('id').primaryKey(),
    variant: text('variant').notNull(),
    url: text('url').notNull(),
    fileId: text('file_id'),
    width: integer('width').notNull(),
    height: integer('height').notNull(),
    sizeBytes: integer('size_bytes'),
    isActive: integer('is_active', { mode: 'boolean' }).notNull().default(false),
    createdBy: text('created_by'),
    createdAt: integer('created_at', { mode: 'timestamp' })
      .notNull()
      .$defaultFn(() => new Date()),
    activatedAt: integer('activated_at', { mode: 'timestamp' }),
  },
  (t) => [
    index('profile_covers_variant_created_idx').on(
      t.variant,
      t.createdAt,
      t.id,
    ),
    uniqueIndex('profile_covers_variant_active_uidx')
      .on(t.variant)
      .where(sql`${t.isActive} = 1`),
  ],
);