import { sql } from 'drizzle-orm';
import { index, integer, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core';
import { generateId } from '@/shared/utils/ulid';
import { kreators } from './kreators.schema';

export const KREATOR_CLAIM_STATUSES = ['pending', 'approved', 'rejected'] as const;
export type KreatorClaimStatus = (typeof KREATOR_CLAIM_STATUSES)[number];

/**
 * Klaim profil kreator oleh akun SambasKu. Bukti `proof_note` privat
 * (hanya antrean admin); tidak diserialkan ke endpoint publik.
 */
export const kreatorClaims = sqliteTable(
  'kreator_claims',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => generateId()),
    kreatorId: text('kreator_id')
      .notNull()
      .references(() => kreators.id),
    userId: text('user_id').notNull(),
    status: text('status', { enum: KREATOR_CLAIM_STATUSES })
      .notNull()
      .default('pending'),
    proofNote: text('proof_note').notNull(),
    rejectReason: text('reject_reason'),
    createdAt: integer('created_at', { mode: 'timestamp' })
      .notNull()
      .$defaultFn(() => new Date()),
    updatedAt: integer('updated_at', { mode: 'timestamp' }),
  },
  (t) => [
    uniqueIndex('kreator_claims_pending_uidx')
      .on(t.kreatorId, t.userId)
      .where(sql`${t.status} = 'pending'`),
    index('kreator_claims_status_idx').on(t.status, t.createdAt),
    index('kreator_claims_user_idx').on(t.userId, t.status),
  ],
);