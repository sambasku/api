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
import { discussionReplies, discussions } from './discussions.schema';

export const DISCUSSION_LEMMA_LINK_STATUSES = [
  'active',
  'pending_correction',
  'rejected',
  'stale',
] as const;
export type DiscussionLemmaLinkStatus =
  (typeof DISCUSSION_LEMMA_LINK_STATUSES)[number];

export const DISCUSSION_LEMMA_LINK_SOURCES = [
  'author',
  'community',
  'correction',
] as const;
export type DiscussionLemmaLinkSource =
  (typeof DISCUSSION_LEMMA_LINK_SOURCES)[number];

/**
 * Span lemma di body diskusi / balasan (posisi start/end = indeks string JS/Dart).
 * Koreksi: status `pending_correction` + `proposed_word_id` sampai di-resolve.
 */
export const discussionLemmaLinks = sqliteTable(
  'discussion_lemma_links',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => generateId()),
    discussionId: text('discussion_id')
      .notNull()
      .references(() => discussions.id),
    replyId: text('reply_id').references(() => discussionReplies.id),
    start: integer('start').notNull(),
    end: integer('end').notNull(),
    wordId: text('word_id')
      .notNull()
      .references(() => words.id),
    status: text('status', { enum: DISCUSSION_LEMMA_LINK_STATUSES })
      .notNull()
      .default('active'),
    source: text('source', { enum: DISCUSSION_LEMMA_LINK_SOURCES })
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
    index('discussion_lemma_links_discussion_idx').on(t.discussionId, t.status),
    index('discussion_lemma_links_reply_idx').on(t.replyId, t.status),
    index('discussion_lemma_links_word_idx').on(t.wordId),
    uniqueIndex('discussion_lemma_links_discussion_span_uidx')
      .on(t.discussionId, t.start, t.end)
      .where(sql`reply_id IS NULL`),
    uniqueIndex('discussion_lemma_links_reply_span_uidx')
      .on(t.replyId, t.start, t.end)
      .where(sql`reply_id IS NOT NULL`),
  ],
);
