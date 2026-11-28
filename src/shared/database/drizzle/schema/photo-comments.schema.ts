import { index, integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';
import { generateId } from '@/shared/utils/ulid';
import { users } from './users.schema';

/** Jenis foto UGC yang bisa dikomentari (#387). */
export const PHOTO_COMMENT_KINDS = [
  'word',
  'place',
  'usaha',
  'cuisine',
  'event',
] as const;
export type PhotoCommentKind = (typeof PHOTO_COMMENT_KINDS)[number];

export const PHOTO_COMMENT_STATUSES = [
  'published',
  'taken_down',
  'deleted_by_author',
] as const;
export type PhotoCommentStatus = (typeof PHOTO_COMMENT_STATUSES)[number];

/**
 * Komentar foto (#387). Satu tabel generik untuk foto lemma, wisata, usaha,
 * kuliner, dan acara. `photo_ref` = id baris foto (word_images / place_images /
 * usaha_images / event_images) atau hash URL 12 hex untuk kuliner (foto kuliner
 * disimpan sebagai JSON tanpa id). `host_id` = id kata/wisata/usaha/kuliner/acara
 * pemilik foto. Post-moderation seperti komentar wisata.
 */
export const photoComments = sqliteTable(
  'photo_comments',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => generateId()),
    photoKind: text('photo_kind', { enum: PHOTO_COMMENT_KINDS }).notNull(),
    photoRef: text('photo_ref').notNull(),
    hostId: text('host_id').notNull(),
    /** null = komentar utama; non-null = balasan (parent harus top-level). */
    parentId: text('parent_id'),
    userId: text('user_id')
      .notNull()
      .references(() => users.id),
    body: text('body').notNull(),
    /** Teks asli sebelum blocklist; null jika tidak disensor. */
    bodyOriginal: text('body_original'),
    status: text('status', { enum: PHOTO_COMMENT_STATUSES })
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
    index('photo_comments_photo_status_idx').on(
      t.photoKind,
      t.photoRef,
      t.status,
      t.id,
    ),
    index('photo_comments_parent_created_idx').on(t.parentId, t.createdAt, t.id),
    index('photo_comments_user_status_idx').on(t.userId, t.status, t.id),
  ],
);

/** Snapshot body tayang sebelum setiap edit (cap 50 di repo). */
export const photoCommentRevisions = sqliteTable(
  'photo_comment_revisions',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => generateId()),
    commentId: text('comment_id')
      .notNull()
      .references(() => photoComments.id, { onDelete: 'cascade' }),
    editorId: text('editor_id')
      .notNull()
      .references(() => users.id),
    body: text('body').notNull(),
    createdAt: integer('created_at', { mode: 'timestamp' })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (t) => [
    index('photo_comment_revisions_comment_idx').on(t.commentId, t.createdAt),
  ],
);
