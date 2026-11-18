import { sqliteTable, text, integer, index } from 'drizzle-orm/sqlite-core';
import { generateId } from '@/shared/utils/ulid';
import { users } from './users.schema';

/**
 * Analitik internal voice room (sementara).
 * BUKAN activity feed - jangan tampilkan di beranda/profil.
 *
 * kind: joined | left | disconnect | join_failed
 */
export const voiceRoomEvents = sqliteTable(
  'voice_room_events',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => generateId()),
    userId: text('user_id')
      .notNull()
      .references(() => users.id),
    kind: text('kind').notNull(),
    room: text('room').notNull().default('sambasku-global'),
    errorCode: text('error_code'),
    detail: text('detail'),
    platform: text('platform'),
    createdAt: integer('created_at', { mode: 'timestamp' })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (t) => [
    index('voice_room_events_kind_created_idx').on(t.kind, t.createdAt),
    index('voice_room_events_user_created_idx').on(t.userId, t.createdAt),
  ],
);
