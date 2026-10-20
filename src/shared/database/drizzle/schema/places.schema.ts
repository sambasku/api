import { sqliteTable, text, integer, real, index, uniqueIndex } from 'drizzle-orm/sqlite-core';
import { generateId } from '@/shared/utils/ulid';

/** Katalog Place (wisata/kuliner/budaya) - SoT Turso, CRUD console. */
export const places = sqliteTable(
  'places',
  {
    id: text('id').primaryKey(),
    slug: text('slug').notNull(),
    name: text('name').notNull(),
    category: text('category').notNull(),
    type: text('type', {
      enum: ['sejarah', 'alam', 'budaya', 'pantai', 'belanja'],
    }),
    lat: real('lat'),
    lng: real('lng'),
    mapsUrl: text('maps_url'),
    shortDescription: text('short_description').notNull(),
    regionId: text('region_id'),
    /** ULID desa di `regions`. Null = belum masuk desa. */
    villageId: text('village_id'),
    hours: text('hours'),
    contact: text('contact'),
    authorId: text('author_id'),
    sourcesJson: text('sources_json').notNull().default('[]'),
    status: text('status', {
      enum: ['draft', 'published', 'archived'],
    })
      .notNull()
      .default('published'),
    createdAt: integer('created_at', { mode: 'timestamp' })
      .notNull()
      .$defaultFn(() => new Date()),
    updatedAt: integer('updated_at', { mode: 'timestamp' }),
    deletedAt: integer('deleted_at', { mode: 'timestamp' }),
  },
  (t) => [
    uniqueIndex('places_slug_uidx').on(t.slug),
    index('places_category_idx').on(t.category),
    index('places_region_id_idx').on(t.regionId),
    index('places_village_id_idx').on(t.villageId),
    index('places_status_idx').on(t.status),
    index('places_status_updated_at_idx').on(t.status, t.updatedAt),
  ],
);

export const placeImages = sqliteTable(
  'place_images',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => generateId()),
    placeId: text('place_id')
      .notNull()
      .references(() => places.id),
    url: text('url').notNull(),
    isMain: integer('is_main', { mode: 'boolean' }).notNull().default(false),
    sortOrder: integer('sort_order').notNull().default(0),
    attributionJson: text('attribution_json'),
  },
  (t) => [index('place_images_place_id_idx').on(t.placeId)],
);
