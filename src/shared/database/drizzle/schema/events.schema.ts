import {
  sqliteTable,
  text,
  integer,
  real,
  index,
  uniqueIndex,
  check,
} from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';
import { generateId } from '@/shared/utils/ulid';
import { eventCategories } from './event-categories.schema';
import { places } from './places.schema';

export const EVENT_SOURCE_TYPES = [
  'facebook',
  'instagram',
  'website',
  'tiktok',
  'youtube',
  'whatsapp',
  'other',
] as const;

export type EventSourceType = (typeof EVENT_SOURCE_TYPES)[number];

/** Katalog Event (acara/agenda Sambas). SoT Turso, CRUD console. */
export const events = sqliteTable(
  'events',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => generateId()),
    slug: text('slug').notNull(),
    name: text('name').notNull(),
    description: text('description').notNull(),
    categoryId: text('category_id')
      .notNull()
      .references(() => eventCategories.id),
    startsAt: integer('starts_at', { mode: 'timestamp' }).notNull(),
    endsAt: integer('ends_at', { mode: 'timestamp' }).notNull(),
    locationText: text('location_text').notNull(),
    lat: real('lat'),
    lng: real('lng'),
    mapsUrl: text('maps_url'),
    posterUrl: text('poster_url'),
    /** Penyelenggara opsional (PRD 6.2): teks, bukan entitas. UI skip jika kosong. */
    organizer: text('organizer'),
    /** Link original konten (FB/IG/website) - disimpan bersih, UTM disisip saat render. */
    sourceUrl: text('source_url'),
    sourceType: text('source_type', { enum: EVENT_SOURCE_TYPES }),
    sourceAttribution: text('source_attribution'),
    /** ULID kecamatan di `regions`. Null = belum diketahui. */
    regionId: text('region_id'),
    /** ULID desa di `regions`. Null = belum masuk desa. */
    villageId: text('village_id'),
    status: text('status', {
      enum: ['draft', 'published', 'archived'],
    })
      .notNull()
      .default('draft'),
    /** Non-null = acara dibatalkan; status pelaksanaan lain diturunkan read-time. */
    cancelledAt: integer('cancelled_at', { mode: 'timestamp' }),
    publishedAt: integer('published_at', { mode: 'timestamp' }),
    authorId: text('author_id'),
    createdAt: integer('created_at', { mode: 'timestamp' })
      .notNull()
      .$defaultFn(() => new Date()),
    updatedAt: integer('updated_at', { mode: 'timestamp' }),
    deletedAt: integer('deleted_at', { mode: 'timestamp' }),
  },
  (t) => [
    uniqueIndex('events_slug_uidx').on(t.slug),
    index('events_category_idx').on(t.categoryId),
    index('events_village_id_idx').on(t.villageId),
    index('events_status_idx').on(t.status),
    index('events_starts_at_idx').on(t.startsAt),
    index('events_status_starts_at_idx').on(t.status, t.startsAt),
    check('events_ends_after_starts', sql`${t.endsAt} >= ${t.startsAt}`),
  ],
);

/** Relasi banyak-ke-banyak Event <-> Place (wisata). */
export const eventPlaces = sqliteTable(
  'event_places',
  {
    eventId: text('event_id')
      .notNull()
      .references(() => events.id, { onDelete: 'cascade' }),
    placeId: text('place_id')
      .notNull()
      .references(() => places.id, { onDelete: 'cascade' }),
    createdAt: integer('created_at', { mode: 'timestamp' })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (t) => [
    index('event_places_event_id_idx').on(t.eventId),
    index('event_places_place_id_idx').on(t.placeId),
  ],
);
