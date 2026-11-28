import { sqliteTable, text, integer, index, uniqueIndex } from 'drizzle-orm/sqlite-core';
import { generateId } from '@/shared/utils/ulid';
import { users } from './users.schema';

/**
 * Chat publik - SoT di Turso.
 * Cermin realtime di Supabase Postgres (api/supabase/migrations).
 * Acuan: docs/backlogs/CHAT_PUBLIK_VOICE.md
 */
export const chatMessages = sqliteTable(
  'chat_messages',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => generateId()),
    channel: text('channel').notNull().default('public'),
    userId: text('user_id')
      .notNull()
      .references(() => users.id),
    username: text('username'),
    displayName: text('display_name'),
    avatarUrl: text('avatar_url'),
    /** text | sticker | voice_note */
    /** text | sticker | voice_note | system */
    kind: text('kind').notNull().default('text'),
    body: text('body'),
    stickerId: text('sticker_id'),
    /** URL publik voice note (repo audios / jsDelivr). */
    audioUrl: text('audio_url'),
    /** Path di repo audios - untuk delete GitHub; tidak di-mirror Supabase. */
    audioPath: text('audio_path'),
    /** Blob sha GitHub Contents API - untuk delete; tidak di-mirror Supabase. */
    audioSha: text('audio_sha'),
    durationMs: integer('duration_ms'),
    replyToId: text('reply_to_id'),
    replySnippet: text('reply_snippet'),
    replyUsername: text('reply_username'),
    editedAt: integer('edited_at', { mode: 'timestamp' }),
    deletedAt: integer('deleted_at', { mode: 'timestamp' }),
    deletedBy: text('deleted_by'),
    createdAt: integer('created_at', { mode: 'timestamp' })
      .notNull()
      .$defaultFn(() => new Date()),
    updatedAt: integer('updated_at', { mode: 'timestamp' }),
  },
  (t) => [
    index('chat_messages_channel_created_idx').on(t.channel, t.createdAt, t.id),
    index('chat_messages_reply_to_idx').on(t.replyToId),
  ],
);

/** Riwayat edit (body sebelum diganti). */
export const chatMessageRevisions = sqliteTable(
  'chat_message_revisions',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => generateId()),
    messageId: text('message_id').notNull(),
    editorId: text('editor_id')
      .notNull()
      .references(() => users.id),
    body: text('body').notNull(),
    createdAt: integer('created_at', { mode: 'timestamp' })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (t) => [index('chat_revisions_message_idx').on(t.messageId, t.createdAt)],
);

/**
 * Salinan moderasi: isi pesan + revisi disalin saat tombstone, sebelum body
 * di-null-kan dan revisi dipurge. Hanya dibaca admin (root/admin) lewat
 * endpoint moderasi. Tidak pernah di-mirror Supabase / wire publik.
 */
export const chatMessageModerationSnapshots = sqliteTable(
  'chat_message_moderation_snapshots',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => generateId()),
    messageId: text('message_id').notNull(),
    userId: text('user_id').notNull(),
    username: text('username'),
    displayName: text('display_name'),
    kind: text('kind').notNull(),
    body: text('body'),
    stickerId: text('sticker_id'),
    replyToId: text('reply_to_id'),
    replySnippet: text('reply_snippet'),
    /** Array JSON `{ body, editor_id, created_at }` saat delete. */
    revisionsJson: text('revisions_json', { mode: 'json' }).notNull(),
    messageCreatedAt: integer('message_created_at', { mode: 'timestamp' }).notNull(),
    deletedAt: integer('deleted_at', { mode: 'timestamp' }).notNull(),
    deletedBy: text('deleted_by').notNull(),
    deletionReason: text('deletion_reason'),
    snapshotAt: integer('snapshot_at', { mode: 'timestamp' })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (t) => [uniqueIndex('chat_moderation_snapshots_message_uidx').on(t.messageId)],
);

/** Audit hapus (tombstone juga di chat_messages.deleted_at). */
export const chatMessageDeletions = sqliteTable(
  'chat_message_deletions',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => generateId()),
    messageId: text('message_id').notNull(),
    deletedBy: text('deleted_by')
      .notNull()
      .references(() => users.id),
    /** author | moderation */
    reason: text('reason'),
    createdAt: integer('created_at', { mode: 'timestamp' })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (t) => [uniqueIndex('chat_deletions_message_uidx').on(t.messageId)],
);
