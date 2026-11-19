import { sqliteTable, text, integer, index } from 'drizzle-orm/sqlite-core';
import { generateId } from '@/shared/utils/ulid';

/**
 * Snapshot vote yang dihapus karena konten makna berubah (G2b).
 * reason: suggestion_applied | suggestion_selfapply | verifier_direct_edit
 */
export const voteResetArchives = sqliteTable(
  'vote_reset_archives',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => generateId()),
    batchId: text('batch_id').notNull(),
    voteId: text('vote_id').notNull(),
    userId: text('user_id').notNull(),
    entityType: text('entity_type').notNull(),
    entityId: text('entity_id').notNull(),
    value: integer('value').notNull(),
    clientId: text('client_id'),
    votedAt: integer('voted_at', { mode: 'timestamp' }).notNull(),
    voteUpdatedAt: integer('vote_updated_at', { mode: 'timestamp' }),
    reason: text('reason').notNull(),
    suggestionId: text('suggestion_id'),
    actorId: text('actor_id').notNull(),
    wordId: text('word_id'),
    resetAt: integer('reset_at', { mode: 'timestamp' })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (t) => [
    index('vote_reset_archives_batch_idx').on(t.batchId),
    index('vote_reset_archives_entity_idx').on(t.entityType, t.entityId),
    index('vote_reset_archives_reset_at_idx').on(t.resetAt),
  ],
);
