import {
  index,
  integer,
  sqliteTable,
  text,
  uniqueIndex,
} from 'drizzle-orm/sqlite-core';
import { generateId } from '@/shared/utils/ulid';
import { users } from './users.schema';

/** Kinds yang boleh jadi endpoint content_links (v1). */
export const CONTENT_LINK_KINDS = [
  'word',
  'article',
  'place',
  'event',
  'usaha',
  'karya',
  'kreator',
  'cuisine',
  'layanan',
] as const;
export type ContentLinkKind = (typeof CONTENT_LINK_KINDS)[number];

/**
 * Tautan undirected lintas konten (ensiklopedia, lemma, eksplorasi).
 * Sebelum insert, urutkan pasangan (kind,id) lexicographic ke a_* / b_*
 * supaya A↔B tidak dobel.
 */
export const contentLinks = sqliteTable(
  'content_links',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => generateId()),
    aKind: text('a_kind', { enum: CONTENT_LINK_KINDS }).notNull(),
    aId: text('a_id').notNull(),
    bKind: text('b_kind', { enum: CONTENT_LINK_KINDS }).notNull(),
    bId: text('b_id').notNull(),
    createdBy: text('created_by').references(() => users.id),
    createdAt: integer('created_at', { mode: 'timestamp' })
      .notNull()
      .$defaultFn(() => new Date()),
    updatedAt: integer('updated_at', { mode: 'timestamp' }),
  },
  (t) => [
    uniqueIndex('content_links_pair_uidx').on(t.aKind, t.aId, t.bKind, t.bId),
    index('content_links_a_idx').on(t.aKind, t.aId),
    index('content_links_b_idx').on(t.bKind, t.bId),
  ],
);
