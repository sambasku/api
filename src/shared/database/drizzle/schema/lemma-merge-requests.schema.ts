import { index, integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';
import { generateId } from '@/shared/utils/ulid';
import { users } from './users.schema';
import { words } from './words.schema';

export const LEMMA_MERGE_STATUSES = ['pending', 'approved', 'rejected'] as const;
export type LemmaMergeStatus = (typeof LEMMA_MERGE_STATUSES)[number];

/** Usulan gabung entri lemma serupa (#318). */
export const lemmaMergeRequests = sqliteTable(
  'lemma_merge_requests',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => generateId()),
    proposerId: text('proposer_id')
      .notNull()
      .references(() => users.id),
    keepWordId: text('keep_word_id')
      .notNull()
      .references(() => words.id),
  /** JSON array word_id yang digabung (tanpa keep). */
    mergeWordIds: text('merge_word_ids', { mode: 'json' }).$type<string[]>().notNull(),
    status: text('status', { enum: LEMMA_MERGE_STATUSES }).notNull().default('pending'),
    reasonText: text('reason_text'),
    reviewedBy: text('reviewed_by').references(() => users.id),
    reviewedAt: integer('reviewed_at', { mode: 'timestamp' }),
    reviewNote: text('review_note'),
    createdAt: integer('created_at', { mode: 'timestamp' })
      .notNull()
      .$defaultFn(() => new Date()),
    updatedAt: integer('updated_at', { mode: 'timestamp' }),
  },
  (t) => [
    index('lemma_merge_requests_status_created_idx').on(t.status, t.createdAt),
    index('lemma_merge_requests_proposer_idx').on(t.proposerId, t.createdAt),
    index('lemma_merge_requests_keep_idx').on(t.keepWordId),
  ],
);