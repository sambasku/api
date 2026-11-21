import { sql } from 'drizzle-orm';
import { sqliteTable, text, integer, index } from 'drizzle-orm/sqlite-core';

/**
 * Katalog stiker bersama (chat + komentar).
 * PK = slug stabil (cheer, wave, …) supaya pesan lama tetap valid.
 */
export const stickers = sqliteTable(
  'stickers',
  {
    id: text('id').primaryKey(),
    imageUrl: text('image_url').notNull(),
    playOnce: integer('play_once', { mode: 'boolean' }).notNull().default(false),
    sortOrder: integer('sort_order').notNull().default(0),
    isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
    /** Slug kategori berbagi; null = hanya di tab Semua. */
    categorySlug: text('category_slug'),
    createdAt: integer('created_at', { mode: 'timestamp' })
      .notNull()
      .$defaultFn(() => new Date()),
    updatedAt: integer('updated_at', { mode: 'timestamp' }),
    deletedAt: integer('deleted_at', { mode: 'timestamp' }),
  },
  (t) => [
    index('stickers_active_sort_idx')
      .on(t.isActive, t.sortOrder, t.id)
      .where(sql`deleted_at is null`),
    index('stickers_active_category_sort_idx')
      .on(t.isActive, t.categorySlug, t.sortOrder, t.id)
      .where(sql`deleted_at is null`),
  ],
);
