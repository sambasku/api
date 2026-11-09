import { sqliteTable, text, integer, index } from 'drizzle-orm/sqlite-core';
import { generateId } from '@/shared/utils/ulid';
import { users } from './users.schema';

/** Staging/public image row (parity discussions). */
export type JinyeImageRow = {
  url: string;
  provider_file_id: string;
  public_url?: string | null;
  content_warnings?: string[];
};

export const JINYE_STATUSES = [
  'published',
  'archived',
  'taken_down',
  'deleted_by_author',
] as const;
export type JinyeStatus = (typeof JINYE_STATUSES)[number];

/**
 * Jinye = status singkat (teks / voice / foto). Post-moderation:
 * create → published. Kuota 1 create / 24 jam di aplikasi.
 */
export const jinye = sqliteTable(
  'jinye',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => generateId()),
    userId: text('user_id')
      .notNull()
      .references(() => users.id),
    /** Caption / teks; boleh string kosong jika media-only. */
    body: text('body').notNull().default(''),
    bodyOriginal: text('body_original'),
    images: text('images', { mode: 'json' })
      .$type<JinyeImageRow[]>()
      .notNull()
      .default([]),
    audioUrl: text('audio_url'),
    audioMimeType: text('audio_mime_type'),
    audioFileSize: integer('audio_file_size'),
    audioDurationMs: integer('audio_duration_ms'),
    audioProvider: text('audio_provider'),
    audioProviderFileId: text('audio_provider_file_id'),
    audioSha: text('audio_sha'),
    /** Original yang di-repost/quote; null = post asli. */
    repostOfId: text('repost_of_id'),
    quoteBody: text('quote_body'),
    status: text('status', { enum: JINYE_STATUSES })
      .notNull()
      .default('published'),
    takenDownBy: text('taken_down_by').references(() => users.id),
    takenDownAt: integer('taken_down_at', { mode: 'timestamp' }),
    publishedCommentCount: integer('published_comment_count').notNull().default(0),
    repostCount: integer('repost_count').notNull().default(0),
    createdAt: integer('created_at', { mode: 'timestamp' })
      .notNull()
      .$defaultFn(() => new Date()),
    updatedAt: integer('updated_at', { mode: 'timestamp' }),
  },
  (t) => [
    index('jinye_status_id_idx').on(t.status, t.id),
    index('jinye_user_created_idx').on(t.userId, t.createdAt, t.id),
    index('jinye_status_created_idx').on(t.status, t.createdAt, t.id),
  ],
);

/** Snapshot body sebelum edit (Phase 6). Cap di aplikasi. */
export const jinyeRevisions = sqliteTable(
  'jinye_revisions',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => generateId()),
    jinyeId: text('jinye_id')
      .notNull()
      .references(() => jinye.id, { onDelete: 'cascade' }),
    editorId: text('editor_id')
      .notNull()
      .references(() => users.id),
    body: text('body').notNull(),
    createdAt: integer('created_at', { mode: 'timestamp' })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (t) => [index('jinye_revisions_jinye_id_idx').on(t.jinyeId, t.createdAt)],
);

export const JINYE_COMMENT_STATUSES = [
  'published',
  'taken_down',
  'deleted_by_author',
] as const;
export type JinyeCommentStatus = (typeof JINYE_COMMENT_STATUSES)[number];

/**
 * Komen / reply 1 level pada Jinye (Phase 2).
 * parent_id null = komen ke OP; non-null = reply ke komen top-level saja.
 */
export const jinyeComments = sqliteTable(
  'jinye_comments',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => generateId()),
    jinyeId: text('jinye_id')
      .notNull()
      .references(() => jinye.id, { onDelete: 'cascade' }),
    /** null = komen OP; set = reply (parent harus top-level). */
    parentId: text('parent_id'),
    userId: text('user_id')
      .notNull()
      .references(() => users.id),
    body: text('body').notNull().default(''),
    bodyOriginal: text('body_original'),
    images: text('images', { mode: 'json' })
      .$type<JinyeImageRow[]>()
      .notNull()
      .default([]),
    status: text('status', { enum: JINYE_COMMENT_STATUSES })
      .notNull()
      .default('published'),
    takenDownBy: text('taken_down_by').references(() => users.id),
    takenDownAt: integer('taken_down_at', { mode: 'timestamp' }),
    createdAt: integer('created_at', { mode: 'timestamp' })
      .notNull()
      .$defaultFn(() => new Date()),
    updatedAt: integer('updated_at', { mode: 'timestamp' }),
  },
  (t) => [
    index('jinye_comments_jinye_created_idx').on(t.jinyeId, t.createdAt, t.id),
    index('jinye_comments_parent_created_idx').on(t.parentId, t.createdAt, t.id),
    index('jinye_comments_status_idx').on(t.status, t.id),
  ],
);
