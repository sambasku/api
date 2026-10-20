import { sqliteTable, text, integer, real, index, uniqueIndex } from 'drizzle-orm/sqlite-core';

/** Katalog wilayah Kabupaten Sambas (kecamatan + desa). SoT Turso. */
export const regions = sqliteTable(
  'regions',
  {
    id: text('id').primaryKey(),
    /** Slug publik: kecamatan, atau `kecamatan/desa`. PK tetap ULID. */
    slug: text('slug').notNull(),
    name: text('name').notNull(),
    type: text('type', {
      enum: ['kecamatan', 'desa'],
    }).notNull(),
    parentId: text('parent_id'),
    code: text('code'),
    lat: real('lat'),
    lng: real('lng'),
    status: text('status', {
      enum: ['draft', 'published', 'archived'],
    })
      .notNull()
      .default('published'),
    sortOrder: integer('sort_order').notNull().default(0),
    createdAt: integer('created_at', { mode: 'timestamp' })
      .notNull()
      .$defaultFn(() => new Date()),
    updatedAt: integer('updated_at', { mode: 'timestamp' }),
    deletedAt: integer('deleted_at', { mode: 'timestamp' }),
  },
  (t) => [
    uniqueIndex('regions_slug_uidx').on(t.slug),
    index('regions_type_idx').on(t.type),
    index('regions_parent_id_idx').on(t.parentId),
    index('regions_status_idx').on(t.status),
    index('regions_type_parent_idx').on(t.type, t.parentId),
    index('regions_status_updated_at_idx').on(t.status, t.updatedAt),
  ],
);
