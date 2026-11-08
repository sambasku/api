import { index, integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';
import { generateId } from '@/shared/utils/ulid';

export const LAYANAN_CONTRIBUTION_KINDS = ['new', 'edit'] as const;
export type LayananContributionKind = (typeof LAYANAN_CONTRIBUTION_KINDS)[number];

export const LAYANAN_CONTRIBUTION_STATUSES = [
  'pending',
  'needs_revision',
  'approved',
  'rejected',
] as const;
export type LayananContributionStatus =
  (typeof LAYANAN_CONTRIBUTION_STATUSES)[number];

/** Usulan layanan. Tidak pernah dibaca feed publik sebelum approve. */
export const layananContributions = sqliteTable(
  'layanan_contributions',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => generateId()),
    kind: text('kind', { enum: LAYANAN_CONTRIBUTION_KINDS }).notNull(),
    userId: text('user_id').notNull(),
    /** Target untuk kind=edit. Null untuk kind=new. */
    layananId: text('layanan_id'),
    payloadJson: text('payload_json').notNull(),
    status: text('status', { enum: LAYANAN_CONTRIBUTION_STATUSES })
      .notNull()
      .default('pending'),
    resultLayananId: text('result_layanan_id'),
    revisionNote: text('revision_note'),
    rejectReasonCode: text('reject_reason_code'),
    rejectReasonText: text('reject_reason_text'),
    createdAt: integer('created_at', { mode: 'timestamp' })
      .notNull()
      .$defaultFn(() => new Date()),
    updatedAt: integer('updated_at', { mode: 'timestamp' }),
    reviewedAt: integer('reviewed_at', { mode: 'timestamp' }),
  },
  (t) => [
    index('layanan_contributions_user_status_idx').on(t.userId, t.status),
    index('layanan_contributions_status_created_idx').on(t.status, t.createdAt),
  ],
);
