import { sqliteTable, text, integer, primaryKey } from 'drizzle-orm/sqlite-core';
import { users } from './users.schema';

/**
 * Gate push FCM hasil review kontribusi (approve/reject) per user.
 * Inbox in-app tidak memakai tabel ini - hanya throttle push.
 */
export const notificationPushCooldowns = sqliteTable(
  'notification_push_cooldowns',
  {
    userId: text('user_id')
      .notNull()
      .references(() => users.id),
    /** contribution_approved | contribution_rejected */
    channel: text('channel').notNull(),
    lastPushAt: integer('last_push_at', { mode: 'timestamp' }).notNull(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.channel] })],
);
