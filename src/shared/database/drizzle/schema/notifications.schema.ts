import { sql } from 'drizzle-orm';
import { sqliteTable, text, integer, index, uniqueIndex } from 'drizzle-orm/sqlite-core';
import { generateId } from '@/shared/utils/ulid';
import { users } from './users.schema';

// Inbox in-app (23-api-notifications.md). Unique per user+type+target agar
// word_comment dan word_vote pada kata yang sama bisa berdampingan.
// action_* = CTA tap (#19); fallback ke target_kind/target_id bila null.
export const notifications = sqliteTable(
  'notifications',
  {
    id: text('id').primaryKey().$defaultFn(() => generateId()),
    userId: text('user_id')
      .notNull()
      .references(() => users.id),
    type: text('type').notNull(),
    title: text('title').notNull(),
    body: text('body').notNull(),
    targetKind: text('target_kind').notNull(),
    targetId: text('target_id').notNull(),
    /** CTA: word | contribution | suggestion | translation_help | url */
    actionKind: text('action_kind'),
    actionValue: text('action_value'),
    readAt: integer('read_at', { mode: 'timestamp' }),
    createdAt: integer('created_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
  },
  (t) => [
    uniqueIndex('notifications_user_type_target_unique').on(
      t.userId,
      t.type,
      t.targetKind,
      t.targetId,
    ),
    index('notifications_user_id_id_idx').on(t.userId, t.id),
    index('notifications_user_unread_idx').on(t.userId).where(sql`read_at is null`),
  ],
);
