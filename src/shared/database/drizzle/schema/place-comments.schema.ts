import { index, integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';
import { generateId } from '@/shared/utils/ulid';
import { users } from './users.schema';
import { places } from './places.schema';

export const PLACE_COMMENT_STATUSES = [
  'published',
  'taken_down',
  'deleted_by_author',
] as const;
export type PlaceCommentStatus = (typeof PLACE_COMMENT_STATUSES)[number];

/**
 * Komentar wisata. Post-moderation seperti `event_comments`:
 * create -> published; admin takedown; penulis hapus sendiri.
 * Body disensor blocklist saat create/edit; body_original menyimpan
 * teks sebelum disensor.
 */
export const placeComments = sqliteTable(
  'place_comments',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => generateId()),
    placeId: text('place_id')
      .notNull()
      .references(() => places.id, { onDelete: 'cascade' }),
    userId: text('user_id')
      .notNull()
      .references(() => users.id),
    body: text('body').notNull(),
    /** Teks asli sebelum blocklist; null jika tidak disensor. */
    bodyOriginal: text('body_original'),
    status: text('status', { enum: PLACE_COMMENT_STATUSES })
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
    index('place_comments_place_status_idx').on(t.placeId, t.status, t.id),
    index('place_comments_user_status_idx').on(t.userId, t.status, t.id),
  ],
);

/** Snapshot body komentar tayang sebelum setiap edit (cap 50 di use case). */
export const placeCommentRevisions = sqliteTable(
  'place_comment_revisions',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => generateId()),
    commentId: text('comment_id')
      .notNull()
      .references(() => placeComments.id, { onDelete: 'cascade' }),
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
    index('place_comment_revisions_comment_idx').on(t.commentId, t.createdAt),
  ],
);