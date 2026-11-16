import { index, integer, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core';
import { generateId } from '@/shared/utils/ulid';

export const KREATOR_KINDS = ['person', 'group'] as const;
export type KreatorKind = (typeof KREATOR_KINDS)[number];

/**
 * Profil kreator (orang/grup) - bukan akun SambasKu.
 * Klaim user menyusul G4 (`kreator_claims`). Karya-first: credits
 * boleh `name_text` tanpa `kreator_id` dulu (lihat KARYA.md).
 */
export const kreators = sqliteTable(
  'kreators',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => generateId()),
    slug: text('slug').notNull(),
    displayName: text('display_name').notNull(),
    kind: text('kind', { enum: KREATOR_KINDS }).notNull().default('person'),
    bio: text('bio'),
    /** Asal/wilayah teks bebas; opsional. */
    originRegion: text('origin_region'),
    /** JSON array `{ label, url }[]` - URL bersih, UTM saat klik. */
    linksJson: text('links_json').notNull().default('[]'),
    createdAt: integer('created_at', { mode: 'timestamp' })
      .notNull()
      .$defaultFn(() => new Date()),
    updatedAt: integer('updated_at', { mode: 'timestamp' }),
    deletedAt: integer('deleted_at', { mode: 'timestamp' }),
  },
  (t) => [
    uniqueIndex('kreators_slug_uidx').on(t.slug),
    index('kreators_display_name_idx').on(t.displayName),
    index('kreators_kind_idx').on(t.kind),
  ],
);
