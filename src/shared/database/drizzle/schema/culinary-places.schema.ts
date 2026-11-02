import { sqliteTable, text, integer, real, index, uniqueIndex } from 'drizzle-orm/sqlite-core';
import { generateId } from '@/shared/utils/ulid';

/**
* Tempat/penjual kuliner (PRD 6.2): restoran, warung, kedai, pedagang pasar,
* penjual keliling. Entitas terpisah dari `cuisines` (PRD 3.4).
*
* Hanya `name` yang wajib. Lokasi/koordinat/alamat opsional - penjual
* keliling boleh didokumentasikan tanpa alamat (PRD 6.2).
*/
export const CULINARY_PLACE_TYPES = [
  'restaurant',
  'warung',
  'kedai',
  'market_stall',
  'street_vendor',
  'home_industry',
  'other',
] as const;
export type CulinaryPlaceType = (typeof CULINARY_PLACE_TYPES)[number];

export const CULINARY_PUBLISH_STATUSES = [
  'draft',
  'published',
  'archived',
  'restricted',
] as const;
export type CulinaryPublishStatus = (typeof CULINARY_PUBLISH_STATUSES)[number];

export const CULINARY_OPERATIONAL_STATUSES = [
  'unknown',
  'operating',
  'temporarily_closed',
  'permanently_closed',
] as const;
export type CulinaryOperationalStatus =
  (typeof CULINARY_OPERATIONAL_STATUSES)[number];

export const culinaryPlaces = sqliteTable(
  'culinary_places',
  {
    id: text('id').primaryKey().$defaultFn(() => generateId()),
    slug: text('slug').notNull(),
    /** Satu-satunya field wajib usulan (PRD 7.2). */
    name: text('name').notNull(),
    type: text('type', { enum: CULINARY_PLACE_TYPES }),
    description: text('description'),
    /** Petunjuk lokasi bebas ("depan pasar Sambas"). */
    locationHint: text('location_hint'),
    addressText: text('address_text'),
    lat: real('lat'),
    lng: real('lng'),
    mapsUrl: text('maps_url'),
    phone: text('phone'),
    whatsapp: text('whatsapp'),
    website: text('website'),
    socialUrl: text('social_url'),
    coverUrl: text('cover_url'),
    operationalStatus: text('operational_status', {
      enum: CULINARY_OPERATIONAL_STATUSES,
    })
      .notNull()
      .default('unknown'),
    publishStatus: text('publish_status', { enum: CULINARY_PUBLISH_STATUSES })
      .notNull()
      .default('published'),
    restrictedReason: text('restricted_reason'),
    restrictedAt: integer('restricted_at', { mode: 'timestamp' }),
    /** Pengelola terverifikasi aktif (klaim approved, maks 1). */
    managerId: text('manager_id'),
    authorId: text('author_id'),
    publishedAt: integer('published_at', { mode: 'timestamp' }),
    createdAt: integer('created_at', { mode: 'timestamp' })
      .notNull()
      .$defaultFn(() => new Date()),
    updatedAt: integer('updated_at', { mode: 'timestamp' }),
    deletedAt: integer('deleted_at', { mode: 'timestamp' }),
  },
  (t) => [
    uniqueIndex('culinary_places_slug_uidx').on(t.slug),
    index('culinary_places_publish_status_idx').on(t.publishStatus),
    index('culinary_places_type_status_idx').on(t.type, t.publishStatus),
    index('culinary_places_manager_id_idx').on(t.managerId),
    index('culinary_places_name_idx').on(t.name),
  ],
);
