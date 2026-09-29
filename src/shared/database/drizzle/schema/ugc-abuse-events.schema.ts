import { sqliteTable, text, integer, index } from 'drizzle-orm/sqlite-core';
import { generateId } from '@/shared/utils/ulid';
import { users } from './users.schema';

/**
 * Ledger sinyal abuse UGC (komentar, diskusi, kontribusi kamus).
 * Policy progresif membaca bobot dalam jendela waktu rolling.
 */
export const ugcAbuseEvents = sqliteTable(
  'ugc_abuse_events',
  {
    id: text('id').primaryKey().$defaultFn(() => generateId()),
    userId: text('user_id')
      .notNull()
      .references(() => users.id),
    /** input_rejected | heavy_censor | rate_lockout | comment_takedown | contribution_spam_reject | policy_mute | policy_pause | policy_deactivate */
    signal: text('signal').notNull(),
    weight: integer('weight').notNull().default(0),
    entityType: text('entity_type'),
    entityId: text('entity_id'),
    /** JSON string opsional (body_hash, reason, dll). */
    meta: text('meta'),
    createdAt: integer('created_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
  },
  (t) => [index('ugc_abuse_events_user_created_idx').on(t.userId, t.createdAt)],
);
