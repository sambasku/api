import { index, integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';
import { generateId } from '@/shared/utils/ulid';
import { users } from './users.schema';
import { cuisines } from './cuisines.schema';

export const CUISINE_COMMENT_STATUSES = [
  'published',
  'taken_down',
  'deleted_by_author',
] as const;
export type CuisineCommentStatus = (typeof CUISINE_COMMENT_STATUSES)[number];

/**
 * Komentar kuliner. Post-moderation seperti `event_comments`:
 * create -> published; admin takedown; penulis hapus sendiri.
 * Body disensor blocklist saat create/edit; body_original menyimpan
 * teks sebelum disensor.
 */
export const cuisineComments = sqliteTable(
  'cuisine_comments',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => generateId()),
    cuisineId: text('cuisine_id')
      .notNull()
      .references(() => cuisines.id, { onDelete: 'cascade' }),
    userId: text('user_id')
      .notNull()
      .references(() => users.id),
    body: text('body').notNull(),
    /** Teks asli sebelum blocklist; null jika tidak disensor. */
    bodyOriginal: text('body_original'),
    status: text('status', { enum: CUISINE_COMMENT_STATUSES })
      .notNull()
      .default('published'),
    reviewedBy: text('reviewed_by').references(() => users.id),
    reviewedAt: integer('reviewed_at', { mode: 'timestamp' }),
    createdAt: integer('created_at', { mode: 'timestamp' })
      .notNull()
      .$defaultFn(() => new Date()),
    updatedAt: integer('updated_at', { mode: 'timestamp' }),
    deletedAt: integer('deleted_at', { mode: 'timestamp' }),
  },
  (t) => [
    index('cuisine_comments_cuisine_status_idx').on(
      t.cuisineId,
      t.status,
      t.id,
    ),
    index('cuisine_comments_user_status_idx').on(t.userId, t.status, t.id),
  ],
);

/** Snapshot body komentar tayang sebelum setiap edit (cap 50 di use case). */
export const cuisineCommentRevisions = sqliteTable(
  'cuisine_comment_revisions',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => generateId()),
    commentId: text('comment_id')
      .notNull()
      .references(() => cuisineComments.id, { onDelete: 'cascade' }),
    editorId: text('editor_id')
      .notNull()
      .references(() => users.id),
    /** Body yang ditampilkan sebelum diganti (pasca-blocklist). */
    body: text('body').notNull(),
    createdAt: integer('created_at', { mode: 'timestamp' })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (t) => [
    index('cuisine_comment_revisions_comment_idx').on(t.commentId, t.createdAt),
  ],
);