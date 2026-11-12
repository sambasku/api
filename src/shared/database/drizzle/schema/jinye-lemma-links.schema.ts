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
import { jinye, jinyeComments } from './jinye.schema';

export const JINYE_LEMMA_LINK_STATUSES = [
  'active',
  'pending_correction',
  'rejected',
  'stale',
] as const;
export type JinyeLemmaLinkStatus = (typeof JINYE_LEMMA_LINK_STATUSES)[number];

export const JINYE_LEMMA_LINK_SOURCES = [
  'author',
  'community',
  'correction',
] as const;
export type JinyeLemmaLinkSource = (typeof JINYE_LEMMA_LINK_SOURCES)[number];

/**
 * Span lemma di body Jinye / komen (posisi start/end = indeks string JS/Dart).
 * Koreksi: status `pending_correction` + `proposed_word_id` sampai di-resolve.
 */
export const jinyeLemmaLinks = sqliteTable(
  'jinye_lemma_links',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => generateId()),
    jinyeId: text('jinye_id').references(() => jinye.id),
    commentId: text('comment_id').references(() => jinyeComments.id),
    start: integer('start').notNull(),
    end: integer('end').notNull(),
    wordId: text('word_id')
      .notNull()
      .references(() => words.id),
    status: text('status', { enum: JINYE_LEMMA_LINK_STATUSES })
      .notNull()
      .default('active'),
    source: text('source', { enum: JINYE_LEMMA_LINK_SOURCES })
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
    index('jinye_lemma_links_jinye_idx').on(t.jinyeId, t.status),
    index('jinye_lemma_links_comment_idx').on(t.commentId, t.status),
    index('jinye_lemma_links_word_idx').on(t.wordId),
    uniqueIndex('jinye_lemma_links_jinye_span_uidx').on(
      t.jinyeId,
      t.start,
      t.end,
    ),
  ],
);
