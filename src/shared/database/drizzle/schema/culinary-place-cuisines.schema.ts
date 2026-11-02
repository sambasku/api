import { sql } from 'drizzle-orm';
import { sqliteTable, text, integer, index, uniqueIndex } from 'drizzle-orm/sqlite-core';
import { generateId } from '@/shared/utils/ulid';
import { cuisines } from './cuisines.schema';
import { culinaryPlaces } from './culinary-places.schema';

export const CULINARY_AVAILABILITIES = [
  'unknown',
  'available',
  'seasonal',
  'unavailable',
] as const;
export type CulinaryAvailability = (typeof CULINARY_AVAILABILITIES)[number];

/**
* Relasi many-to-many kuliner <-> tempat (PRD 6.3).
*
* FK ON DELETE restrict: menghapus relasi TIDAK boleh menghapus kuliner
* maupun tempatnya. Arsip = `publish_status`/`deleted_at`.
*/
export const culinaryPlaceCuisines = sqliteTable(
  'culinary_place_cuisines',
  {
    id: text('id').primaryKey().$defaultFn(() => generateId()),
    cuisineId: text('cuisine_id')
      .notNull()
      .references(() => cuisines.id, { onDelete: 'restrict' }),
    placeId: text('place_id')
      .notNull()
      .references(() => culinaryPlaces.id, { onDelete: 'restrict' }),
    availability: text('availability', { enum: CULINARY_AVAILABILITIES })
      .notNull()
      .default('unknown'),
    note: text('note'),
    publishStatus: text('publish_status', {
      enum: ['draft', 'published', 'archived', 'restricted'],
    })
      .notNull()
      .default('published'),
    authorId: text('author_id'),
    createdAt: integer('created_at', { mode: 'timestamp' })
      .notNull()
      .$defaultFn(() => new Date()),
    updatedAt: integer('updated_at', { mode: 'timestamp' }),
    deletedAt: integer('deleted_at', { mode: 'timestamp' }),
  },
  (t) => [
    index('culinary_place_cuisines_cuisine_idx').on(t.cuisineId, t.publishStatus),
    index('culinary_place_cuisines_place_idx').on(t.placeId, t.publishStatus),
    uniqueIndex('culinary_place_cuisines_pair_uidx')
      .on(t.cuisineId, t.placeId)
      .where(sql`${t.deletedAt} IS NULL`),
  ],
);
