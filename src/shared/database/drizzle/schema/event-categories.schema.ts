import { sqliteTable, text, integer, index } from 'drizzle-orm/sqlite-core';

/** Referensi kategori event (budaya, festival, olahraga, ...). SoT Turso. */
export const eventCategories = sqliteTable(
  'event_categories',
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
    index('event_categories_status_idx').on(t.status),
    index('event_categories_sort_idx').on(t.sortOrder),
  ],
);
