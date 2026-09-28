import { sqliteTable, text, integer, index } from 'drizzle-orm/sqlite-core';
import { generateId } from '@/shared/utils/ulid';
import { users } from './users.schema';

export type DiscussionImageRow = {
  url: string;
  provider_file_id: string;
  public_url?: string | null;
  content_warnings?: string[];
};

/** Thread Ruang Diskusi (feed komunitas). Staging ImageKit → GitHub on approve. */
export const discussions = sqliteTable(
  'discussions',
  {
    id: text('id').primaryKey().$defaultFn(() => generateId()),
    userId: text('user_id')
      .notNull()
      .references(() => users.id),
    body: text('body'),
    /** Tautan https opsional untuk share konten luar. */
    linkUrl: text('link_url'),
    images: text('images', { mode: 'json' }).$type<DiscussionImageRow[]>().notNull(),
    // pending_review | published | rejected | taken_down
    status: text('status').notNull().default('pending_review'),
    rejectionNote: text('rejection_note'),
    reviewedBy: text('reviewed_by').references(() => users.id),
    reviewedAt: integer('reviewed_at', { mode: 'timestamp' }),
    pinnedReplyId: text('pinned_reply_id'),
    createdAt: integer('created_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
    updatedAt: integer('updated_at', { mode: 'timestamp' }),
  },
  (t) => [
    index('discussions_status_id_idx').on(t.status, t.id),
    index('discussions_user_id_idx').on(t.userId, t.id),
  ],
);

/** Balasan komunitas pada diskusi yang sudah tayang (post-moderation). */
export const discussionReplies = sqliteTable(
  'discussion_replies',
  {
    id: text('id').primaryKey().$defaultFn(() => generateId()),
    discussionId: text('discussion_id')
      .notNull()
      .references(() => discussions.id),
    userId: text('user_id')
      .notNull()
      .references(() => users.id),
    body: text('body').notNull(),
    bodyOriginal: text('body_original'),
    // published | taken_down | deleted_by_author
    status: text('status').notNull().default('published'),
    reviewedBy: text('reviewed_by').references(() => users.id),
    reviewedAt: integer('reviewed_at', { mode: 'timestamp' }),
    createdAt: integer('created_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
    updatedAt: integer('updated_at', { mode: 'timestamp' }),
  },
  (t) => [
    index('discussion_replies_discussion_created_idx').on(t.discussionId, t.createdAt, t.id),
    index('discussion_replies_status_idx').on(t.status, t.id),
  ],
);
