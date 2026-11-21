import {
  index,
  integer,
  sqliteTable,
  text,
  uniqueIndex,
} from 'drizzle-orm/sqlite-core';
import { generateId } from '@/shared/utils/ulid';
import { users } from './users.schema';
import { words } from './words.schema';
import { karyaExcerpts } from './karya-excerpts.schema';

export const KARYA_LEMMA_LINK_STATUSES = [
  'active',
  'pending_correction',
  'rejected',
  'stale',
] as const;
export type KaryaLemmaLinkStatus = (typeof KARYA_LEMMA_LINK_STATUSES)[number];

export const KARYA_LEMMA_LINK_SOURCES = [
  'author',
  'community',
  'correction',
] as const;
export type KaryaLemmaLinkSource = (typeof KARYA_LEMMA_LINK_SOURCES)[number];

/** Hak excerpt yang boleh punya tautan lemma (bukan unknown). */
export const KARYA_EXCERPT_LEMMA_LINK_RIGHTS = [
  'public_domain',
  'licensed',
  'permission',
  'fair_quote',
] as const;

/**
 * Span lemma di teks cuplikan karya (indeks start/end = string JS/Dart).
 */
export const karyaLemmaLinks = sqliteTable(
  'karya_lemma_links',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => generateId()),
    excerptId: text('excerpt_id')
      .notNull()
      .references(() => karyaExcerpts.id, { onDelete: 'cascade' }),
    start: integer('start').notNull(),
    end: integer('end').notNull(),
    wordId: text('word_id')
      .notNull()
      .references(() => words.id),
    status: text('status', { enum: KARYA_LEMMA_LINK_STATUSES })
      .notNull()
      .default('active'),
    source: text('source', { enum: KARYA_LEMMA_LINK_SOURCES })
      .notNull()
      .default('author'),
    proposedWordId: text('proposed_word_id').references(() => words.id),
    proposedBy: text('proposed_by').references(() => users.id),
    reviewedBy: text('reviewed_by').references(() => users.id),
    reviewedAt: integer('reviewed_at', { mode: 'timestamp' }),
    createdAt: integer('created_at', { mode: 'timestamp' })
      .notNull()
      .$defaultFn(() => new Date()),
    updatedAt: integer('updated_at', { mode: 'timestamp' }),
  },
  (t) => [
    index('karya_lemma_links_excerpt_idx').on(t.excerptId, t.status),
    index('karya_lemma_links_word_idx').on(t.wordId),
    uniqueIndex('karya_lemma_links_excerpt_span_uidx').on(
      t.excerptId,
      t.start,
      t.end,
    ),
  ],
);