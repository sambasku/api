import { index, integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';

/**
 * Master kategori komunitas (`kategori_komunitas`).
 * Pola sama event/usaha categories: id slug stabil, nama tampil, status publish.
 */
export const kategoriKomunitas = sqliteTable(
  'kategori_komunitas',
  {
    id: text('id').primaryKey(),
    name: text('name').notNull(),
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
    index('kategori_komunitas_status_idx').on(t.status),
    index('kategori_komunitas_sort_idx').on(t.sortOrder),
  ],
);
