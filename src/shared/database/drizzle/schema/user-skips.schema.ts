import { sqliteTable, text, integer, uniqueIndex } from 'drizzle-orm/sqlite-core';
import { generateId } from '@/shared/utils/ulid';
import { users } from './users.schema';

// Skip permanen per user untuk deck vote (target word) dan antrean review
// (target contribution). Bukan vote dan bukan keputusan review: status item
// tidak berubah, user lain tetap melihatnya. Unik per (user, tipe, target)
// supaya POST ulang idempoten. Target TANPA FK - preseden votes.
export const userSkips = sqliteTable(
  'user_skips',
  {
    id: text('id').primaryKey().$defaultFn(() => generateId()),
    userId: text('user_id')
      .notNull()
      .references(() => users.id),
    // 'word' | 'contribution' | 'search_miss'
    targetType: text('target_type').notNull(),
    targetId: text('target_id').notNull(),
    createdAt: integer('created_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
  },
  (t) => [
    uniqueIndex('user_skips_user_target_unique').on(t.userId, t.targetType, t.targetId),
  ],
);
