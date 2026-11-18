import { index, integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';
import { generateId } from '@/shared/utils/ulid';
import { users } from './users.schema';
import { usahas } from './usahas.schema';

export const USAHA_COMMENT_STATUSES = [
  'published',
  'taken_down',
  'deleted_by_author',
] as const;
export type UsahaCommentStatus = (typeof USAHA_COMMENT_STATUSES)[number];

/**
 * Komentar usaha. Post-moderation seperti `event_comments`:
 * create -> published; admin takedown; penulis hapus sendiri.
 * Body disensor blocklist saat create/edit; body_original menyimpan
 * teks sebelum disensor.
 */
export const usahaComments = sqliteTable(
  'usaha_comments',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => generateId()),
    usahaId: text('usaha_id')
      .notNull()
      .references(() => usahas.id, { onDelete: 'cascade' }),
    userId: text('user_id')
      .notNull()
      .references(() => users.id),
    body: text('body').notNull(),
    /** Teks asli sebelum blocklist; null jika tidak disensor. */
    bodyOriginal: text('body_original'),
    status: text('status', { enum: USAHA_COMMENT_STATUSES })
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
    index('usaha_comments_usaha_status_idx').on(t.usahaId, t.status, t.id),
    index('usaha_comments_user_status_idx').on(t.userId, t.status, t.id),
  ],
);

/** Snapshot body komentar tayang sebelum setiap edit (cap 50 di use case). */
export const usahaCommentRevisions = sqliteTable(
  'usaha_comment_revisions',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => generateId()),
    commentId: text('comment_id')
      .notNull()
      .references(() => usahaComments.id, { onDelete: 'cascade' }),
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
    index('usaha_comment_revisions_comment_idx').on(t.commentId, t.createdAt),
  ],
);