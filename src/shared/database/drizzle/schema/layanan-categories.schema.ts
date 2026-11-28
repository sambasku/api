import { check, index, integer, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';

export const LAYANAN_CATEGORY_STATUSES = ['published', 'archived'] as const;
export type LayananCategoryStatus = (typeof LAYANAN_CATEGORY_STATUSES)[number];

/**
 * Master kategori layanan publik. `id` = slug, dipakai sebagai `layanans.category` (tidak boleh diubah).
 * `short_label` untuk chip & label tabel (unik di antara kategori hidup).
 * `status` archived: layanan lama tetap tampil, kategori tidak bisa dipilih untuk input baru.
 */
export const layananCategories = sqliteTable(
  'layanan_categories',
  {
    id: text('id').primaryKey(),
    name: text('name').notNull(),
    shortLabel: text('short_label').notNull(),
    icon: text('icon').notNull().default('siren'),
    status: text('status', { enum: LAYANAN_CATEGORY_STATUSES }).notNull().default('published'),
    sortOrder: integer('sort_order').notNull().default(0),
    createdAt: integer('created_at', { mode: 'timestamp' })
      .notNull()
      .$defaultFn(() => new Date()),
    updatedAt: integer('updated_at', { mode: 'timestamp' }),
    deletedAt: integer('deleted_at', { mode: 'timestamp' }),
  },
  (t) => [
    index('layanan_categories_status_idx').on(t.status),
    index('layanan_categories_sort_idx').on(t.sortOrder),
    uniqueIndex('layanan_categories_short_label_uq')
      .on(t.shortLabel)
      .where(sql`${t.deletedAt} IS NULL`),
    check('layanan_categories_status_chk', sql`${t.status} IN ('published', 'archived')`),
  ],
);
