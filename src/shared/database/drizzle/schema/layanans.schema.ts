import { index, integer, real, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core';
import { generateId } from '@/shared/utils/ulid';

export const LAYANAN_CATEGORIES = ['ambulance', 'fire'] as const;
export type LayananCategory = (typeof LAYANAN_CATEGORIES)[number];

export const LAYANAN_PUBLISH_STATUSES = ['published', 'unpublished'] as const;
export type LayananPublishStatus = (typeof LAYANAN_PUBLISH_STATUSES)[number];

/**
 * Direktori layanan publik per kecamatan (fase 1: ambulans + pemadam).
 * Baris publik hanya yang `published`. Usulan tinggal di `layanan_contributions`.
 */
export const layanans = sqliteTable(
  'layanans',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => generateId()),
    slug: text('slug').notNull(),
    category: text('category', { enum: LAYANAN_CATEGORIES }).notNull(),
    name: text('name').notNull(),
    phone: text('phone').notNull(),
    whatsapp: text('whatsapp'),
    addressText: text('address_text'),
    lat: real('lat'),
    lng: real('lng'),
    mapsUrl: text('maps_url'),
    /** ULID kecamatan. Wajib. */
    regionId: text('region_id').notNull(),
    villageId: text('village_id'),
    note: text('note'),
    publishStatus: text('publish_status', { enum: LAYANAN_PUBLISH_STATUSES })
      .notNull()
      .default('published'),
    /** Pengusul. Null hanya jika baris lama tanpa aktor. Admin create = admin. */
    authorId: text('author_id'),
    createdAt: integer('created_at', { mode: 'timestamp' })
      .notNull()
      .$defaultFn(() => new Date()),
    /** Terakhir dicek: approve atau sunting admin. */
    updatedAt: integer('updated_at', { mode: 'timestamp' }),
  },
  (t) => [
    uniqueIndex('layanans_slug_uidx').on(t.slug),
    index('layanans_region_status_idx').on(t.regionId, t.publishStatus, t.category),
  ],
);
