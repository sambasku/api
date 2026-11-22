import { sql } from 'drizzle-orm';
import {
  sqliteTable,
  text,
  integer,
  index,
  uniqueIndex,
} from 'drizzle-orm/sqlite-core';
import { generateId } from '@/shared/utils/ulid';
import { cuisines } from './cuisines.schema';
import { usahas } from './usahas.schema';

export const CUISINE_USAHA_AVAILABILITIES = [
  'unknown',
  'available',
  'seasonal',
  'unavailable',
] as const;
export type CuisineUsahaAvailability =
  (typeof CUISINE_USAHA_AVAILABILITIES)[number];

/**
 * Relasi many-to-many kuliner <-> usaha (penjual).
 * Tempat kuliner mandiri dihapus: penjual = usaha (PRD Kuliner -> Usaha).
 *
 * FK ON DELETE restrict: menghapus relasi TIDAK boleh menghapus kuliner
 * maupun usahanya. Arsip = `publish_status`/`deleted_at`.
 */
export const cuisineUsahas = sqliteTable(
  'cuisine_usahas',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => generateId()),
    cuisineId: text('cuisine_id')
      .notNull()
      .references(() => cuisines.id, { onDelete: 'restrict' }),
    usahaId: text('usaha_id')
      .notNull()
      .references(() => usahas.id, { onDelete: 'restrict' }),
    availability: text('availability', {
      enum: CUISINE_USAHA_AVAILABILITIES,
    })
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
    index('cuisine_usahas_cuisine_idx').on(t.cuisineId, t.publishStatus),
    index('cuisine_usahas_usaha_idx').on(t.usahaId, t.publishStatus),
    uniqueIndex('cuisine_usahas_pair_uidx')
      .on(t.cuisineId, t.usahaId)
      .where(sql`${t.deletedAt} IS NULL`),
  ],
);
