import { sql } from 'drizzle-orm';
import { index, integer, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core';
import { generateId } from '@/shared/utils/ulid';

export const CULINARY_CLAIM_STATUSES = [
  'pending',
  'approved',
  'rejected',
  'cancelled',
] as const;
export type CulinaryClaimStatus = (typeof CULINARY_CLAIM_STATUSES)[number];

export const CULINARY_CLAIM_REJECT_REASONS = [
  'evidence_insufficient',
  'claim_conflict',
  'not_owner',
  'other',
] as const;
export type CulinaryClaimRejectReason =
  (typeof CULINARY_CLAIM_REJECT_REASONS)[number];

/**
* Klaim pengelolaan tempat kuliner (PRD 10). Wajib login; ditinjau admin.
* `contact_evidence` PRIVAT - tidak pernah diserialkan di endpoint publik.
* Mengusulkan tempat TIDAK memberi hak pengelolaan (PRD 10 ketentuan).
*/
export const culinaryClaims = sqliteTable(
  'culinary_claims',
  {
    id: text('id').primaryKey().$defaultFn(() => generateId()),
    placeId: text('place_id').notNull(),
    userId: text('user_id').notNull(),
    /** Bukti verifikasi PRIVAT - jangan pernah bocor ke endpoint publik. */
    contactEvidence: text('contact_evidence').notNull(),
    note: text('note'),
    status: text('status', { enum: CULINARY_CLAIM_STATUSES })
      .notNull()
      .default('pending'),
    rejectReasonCode: text('reject_reason_code'),
    rejectReasonText: text('reject_reason_text'),
    reviewedBy: text('reviewed_by'),
    reviewedAt: integer('reviewed_at', { mode: 'timestamp' }),
    createdAt: integer('created_at', { mode: 'timestamp' })
      .notNull()
      .$defaultFn(() => new Date()),
    updatedAt: integer('updated_at', { mode: 'timestamp' }),
  },
  (t) => [
    index('culinary_claims_place_status_idx').on(t.placeId, t.status),
    index('culinary_claims_user_idx').on(t.userId, t.status),
    uniqueIndex('culinary_claims_pending_user_uidx')
      .on(t.placeId, t.userId)
      .where(sql`${t.status} = 'pending'`),
  ],
);
