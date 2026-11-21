import { index, integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';
import { generateId } from '@/shared/utils/ulid';

export const KARYA_CONTRIBUTION_KINDS = [
  'new', // usulan karya baru (wajib login)
  'edit', // perbaikan metadata / credits / access_links
  'excerpt', // usulan cuplikan/lirik (pre-moderation)
] as const;
export type KaryaContributionKind = (typeof KARYA_CONTRIBUTION_KINDS)[number];

export const KARYA_CONTRIBUTION_STATUSES = [
  'pending',
  'needs_revision',
  'approved',
  'rejected',
] as const;
export type KaryaContributionStatus =
  (typeof KARYA_CONTRIBUTION_STATUSES)[number];

/**
 * Semua pengajuan Karya dalam satu tabel (pola usaha/kuliner).
 * Usulan publik wajib login (KARYA.md keputusan #12).
 */
export const karyaContributions = sqliteTable(
  'karya_contributions',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => generateId()),
    kind: text('kind', { enum: KARYA_CONTRIBUTION_KINDS }).notNull(),
    userId: text('user_id').notNull(),
    /** Target karya. Null hanya untuk kind=new. */
    karyaId: text('karya_id'),
    lockedFields: text('locked_fields').notNull().default(''),
    payloadJson: text('payload_json').notNull(),
    baseUpdatedAt: integer('base_updated_at', { mode: 'timestamp' }),
    status: text('status', { enum: KARYA_CONTRIBUTION_STATUSES })
      .notNull()
      .default('pending'),
    resultKaryaId: text('result_karya_id'),
    resultExcerptId: text('result_excerpt_id'),
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
    index('karya_contributions_user_status_idx').on(t.userId, t.status),
    index('karya_contributions_status_created_idx').on(t.status, t.createdAt),
    index('karya_contributions_karya_idx').on(t.karyaId, t.status),
    index('karya_contributions_kind_status_idx').on(t.kind, t.status),
  ],
);
