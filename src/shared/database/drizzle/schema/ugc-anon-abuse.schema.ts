import { sqliteTable, text, integer, index, primaryKey } from 'drizzle-orm/sqlite-core';
import { generateId } from '@/shared/utils/ulid';

/**
 * Ledger abuse kontribusi tamu - keyed IP atau X-Device-Id.
 * Jangan pakai ANONIM_USER_ID (shared sink semua tamu).
 */
export const ugcAnonAbuseEvents = sqliteTable(
  'ugc_anon_abuse_events',
  {
    id: text('id').primaryKey().$defaultFn(() => generateId()),
    /** ip | device */
    subjectKind: text('subject_kind').notNull(),
    subjectKey: text('subject_key').notNull(),
    signal: text('signal').notNull(),
    weight: integer('weight').notNull().default(0),
    entityType: text('entity_type'),
    entityId: text('entity_id'),
    meta: text('meta'),
    createdAt: integer('created_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
  },
  (t) => [
    index('ugc_anon_abuse_events_subject_created_idx').on(
      t.subjectKind,
      t.subjectKey,
      t.createdAt,
    ),
  ],
);

/** Mute sementara per IP atau device (kontribusi anon). */
export const ugcAnonMutes = sqliteTable(
  'ugc_anon_mutes',
  {
    subjectKind: text('subject_kind').notNull(),
    subjectKey: text('subject_key').notNull(),
    mutedUntil: integer('muted_until', { mode: 'timestamp' }).notNull(),
    updatedAt: integer('updated_at', { mode: 'timestamp' }),
  },
  (t) => [primaryKey({ columns: [t.subjectKind, t.subjectKey] })],
);
