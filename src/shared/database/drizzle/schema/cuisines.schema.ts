import { sqliteTable, text, integer, index, uniqueIndex } from 'drizzle-orm/sqlite-core';
import { generateId } from '@/shared/utils/ulid';
import { culinaryCategories } from './culinary-categories.schema';

export const CUISINE_PUBLISH_STATUSES = [
  'draft',
  'published',
  'archived',
  'restricted',
] as const;
export type CuisinePublishStatus = (typeof CUISINE_PUBLISH_STATUSES)[number];

/**
* Kuliner (makanan/minuman) - PRD Kuliner 6.1. SoT Turso, pola `usahas`.
*
* Dokumentasi opsional (deskripsi, bahan, saran penyajian, gambar, sumber)
* BUKAN syarat usulan - satu field wajib: `name` (PRD 3.1). Atribusi &
* lisensi gambar disimpan verbatim di `images_json` (PRD 13).
*/
export const cuisines = sqliteTable(
  'cuisines',
  {
    id: text('id').primaryKey().$defaultFn(() => generateId()),
    slug: text('slug').notNull(),
    /** Satu-satunya field wajib usulan (PRD 7.1). */
    name: text('name').notNull(),
    description: text('description'),
    /** Opsional saat usulan (PRD 6.4). */
    categoryId: text('category_id').references(() => culinaryCategories.id),
    /** Asal/wilayah terkait - teks bebas, opsional (bukan FK wilayah). */
    originRegion: text('origin_region'),
    /** JSON array `[{url,isMain,attribution:{name,provider,url,license,license_url}}]`. */
    imagesJson: text('images_json'),
    /** JSON array string bahan. */
    ingredientsJson: text('ingredients_json'),
    servingSuggestion: text('serving_suggestion'),
    /** JSON array string kata kunci. */
    tagsJson: text('tags_json'),
    /** JSON array `[{name,type,address,license,license_url}]` (PRD 13). */
    sourcesJson: text('sources_json'),
    /** Lisensi koleksi teks (mis. "CC BY-SA 4.0" dari cuisines.json). */
    license: text('license'),
    publishStatus: text('publish_status', { enum: CUISINE_PUBLISH_STATUSES })
      .notNull()
      .default('published'),
    restrictedReason: text('restricted_reason'),
    restrictedAt: integer('restricted_at', { mode: 'timestamp' }),
    /** Pengusul asli; null = admin / anonim. */
    authorId: text('author_id'),
    publishedAt: integer('published_at', { mode: 'timestamp' }),
    createdAt: integer('created_at', { mode: 'timestamp' })
      .notNull()
      .$defaultFn(() => new Date()),
    updatedAt: integer('updated_at', { mode: 'timestamp' }),
    deletedAt: integer('deleted_at', { mode: 'timestamp' }),
  },
  (t) => [
    uniqueIndex('cuisines_slug_uidx').on(t.slug),
    index('cuisines_publish_status_idx').on(t.publishStatus),
    index('cuisines_status_category_idx').on(t.publishStatus, t.categoryId),
    index('cuisines_name_idx').on(t.name),
  ],
);
