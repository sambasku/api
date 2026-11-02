import {
  sqliteTable,
  text,
  integer,
  real,
  index,
  uniqueIndex,
} from 'drizzle-orm/sqlite-core';
import { generateId } from '@/shared/utils/ulid';
import { usahaCategories } from './usaha-categories.schema';

export const USAHA_KINDS = ['product', 'service', 'both'] as const;
export type UsahaKind = (typeof USAHA_KINDS)[number];

export const USAHA_PUBLISH_STATUSES = [
  'draft',
  'published',
  'archived',
  'restricted',
] as const;
export type UsahaPublishStatus = (typeof USAHA_PUBLISH_STATUSES)[number];

export const USAHA_OPERATIONAL_STATUSES = [
  'unknown',
  'open',
  'temporarily_closed',
  'permanently_closed',
] as const;
export type UsahaOperationalStatus = (typeof USAHA_OPERATIONAL_STATUSES)[number];

/**
 * Direktori usaha & jasa lokal (PRD Usaha). SoT Turso.
 *
 * Status dipisah per dimensi (PRD 11) - JANGAN digabung:
 * - `publish_status`      : visibilitas di direktori publik
 * - `operational_status`  : kondisi usaha (buka/tutup), tidak memengaruhi publikasi
 * - klaim                 : tabel `usaha_claims` (manager_id = pengelola aktif)
 * - perubahan             : tabel `usaha_contributions`
 */
export const usahas = sqliteTable(
  'usahas',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => generateId()),
    slug: text('slug').notNull(),
    /** Wajib (PRD 6.1) - satu-satunya field minimum bersama wilayah. */
    name: text('name').notNull(),
    description: text('description'),
    /** Opsional saat usulan (PRD 6.1). */
    categoryId: text('category_id').references(() => usahaCategories.id),
    kind: text('kind', { enum: USAHA_KINDS }).notNull().default('product'),
    /** Wilayah administratif - wajib secara alur (divalidasi use-case). */
    regionId: text('region_id'),
    villageId: text('village_id'),
    /** Alamat/petunjuk lokasi; opsional. Untuk jasa tanpa tempat = area layanan. */
    addressText: text('address_text'),
    lat: real('lat'),
    lng: real('lng'),
    mapsUrl: text('maps_url'),
    /** Kontak PUBLIK - terpisah dari bukti klaim (PRD 6.2 #6). */
    phone: text('phone'),
    whatsapp: text('whatsapp'),
    website: text('website'),
    socialUrl: text('social_url'),
    coverUrl: text('cover_url'),
    publishStatus: text('publish_status', { enum: USAHA_PUBLISH_STATUSES })
      .notNull()
      .default('draft'),
    operationalStatus: text('operational_status', {
      enum: USAHA_OPERATIONAL_STATUSES,
    })
      .notNull()
      .default('unknown'),
    /** Pembatasan sementara (PRD 12.4) - alasan wajib, jejak audit terpisah. */
    restrictedReason: text('restricted_reason'),
    restrictedAt: integer('restricted_at', { mode: 'timestamp' }),
    /** Pengelola terverifikasi AKTIF (maks 1 per entri, PRD 8). */
    managerId: text('manager_id'),
    /** Pengusul asli. Null = dibuat admin / usulan anonim. */
    authorId: text('author_id'),
    publishedAt: integer('published_at', { mode: 'timestamp' }),
    createdAt: integer('created_at', { mode: 'timestamp' })
      .notNull()
      .$defaultFn(() => new Date()),
    updatedAt: integer('updated_at', { mode: 'timestamp' }),
    deletedAt: integer('deleted_at', { mode: 'timestamp' }),
  },
  (t) => [
    uniqueIndex('usahas_slug_uidx').on(t.slug),
    index('usahas_publish_status_idx').on(t.publishStatus),
    index('usahas_status_category_idx').on(t.publishStatus, t.categoryId),
    index('usahas_region_id_idx').on(t.regionId),
    index('usahas_village_id_idx').on(t.villageId),
    index('usahas_manager_id_idx').on(t.managerId),
    index('usahas_status_updated_at_idx').on(t.publishStatus, t.updatedAt),
  ],
);

/**
 * Katalog produk/jasa (PRD 6.3) - opsional, bukan inventaris.
 * `price_text` teks bebas: kosong = harga belum dicantumkan (BUKAN gratis).
 */
export const usahaItems = sqliteTable(
  'usaha_items',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => generateId()),
    usahaId: text('usaha_id')
      .notNull()
      .references(() => usahas.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    description: text('description'),
    priceText: text('price_text'),
    imageUrl: text('image_url'),
    sortOrder: integer('sort_order').notNull().default(0),
    status: text('status', { enum: ['active', 'deleted'] })
      .notNull()
      .default('active'),
    createdAt: integer('created_at', { mode: 'timestamp' })
      .notNull()
      .$defaultFn(() => new Date()),
    updatedAt: integer('updated_at', { mode: 'timestamp' }),
  },
  (t) => [
    index('usaha_items_usaha_status_idx').on(t.usahaId, t.status, t.sortOrder),
  ],
);
