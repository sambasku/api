import { sql } from 'drizzle-orm';
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

export const UGC_COMMENT_ANCHOR_KINDS = [
  'word_comment',
  'place_comment',
  'usaha_comment',
  'cuisine_comment',
  'event_comment',
  'article_comment',
  'karya_comment',
  'photo_comment',
] as const;
export type UgcCommentAnchorKind = (typeof UGC_COMMENT_ANCHOR_KINDS)[number];

export const UGC_COMMENT_LEMMA_LINK_STATUSES = [
  'active',
  'pending_correction',
  'rejected',
  'stale',
] as const;
export type UgcCommentLemmaLinkStatus =
  (typeof UGC_COMMENT_LEMMA_LINK_STATUSES)[number];

export const UGC_COMMENT_LEMMA_LINK_SOURCES = [
  'author',
  'community',
  'correction',
] as const;
export type UgcCommentLemmaLinkSource =
  (typeof UGC_COMMENT_LEMMA_LINK_SOURCES)[number];

/**
 * Span lemma pada body komentar UGC (kata, wisata, usaha, kuliner, acara, artikel).
 * Indeks start/end = string JS/Dart.
 */
export const ugcCommentLemmaLinks = sqliteTable(
  'ugc_comment_lemma_links',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => generateId()),
    anchorKind: text('anchor_kind', { enum: UGC_COMMENT_ANCHOR_KINDS }).notNull(),
    hostId: text('host_id').notNull(),
    commentId: text('comment_id').notNull(),
    start: integer('start').notNull(),
    end: integer('end').notNull(),
    wordId: text('word_id')
      .notNull()
      .references(() => words.id),
    status: text('status', { enum: UGC_COMMENT_LEMMA_LINK_STATUSES })
      .notNull()
      .default('active'),
    source: text('source', { enum: UGC_COMMENT_LEMMA_LINK_SOURCES })
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
    index('ugc_comment_lemma_host_comment_idx').on(
      t.anchorKind,
      t.hostId,
      t.commentId,
      t.status,
    ),
    uniqueIndex('ugc_comment_lemma_span_uniq')
      .on(t.anchorKind, t.commentId, t.start, t.end)
      .where(sql`status in ('active', 'pending_correction')`),
  ],
);