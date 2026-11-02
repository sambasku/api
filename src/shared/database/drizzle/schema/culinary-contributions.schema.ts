import { index, integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';
import { generateId } from '@/shared/utils/ulid';

export const CULINARY_CONTRIBUTION_KINDS = [
  'new_cuisine', // usulan kuliner baru (anonim boleh, PRD 7.1)
  'new_place', // usulan tempat/penjual baru (anonim boleh, PRD 7.2)
  'link', // usulan hubungan kuliner-tempat (PRD 7.3)
  'cuisine_edit', // perbaikan data kuliner (PRD 7.4)
  'place_edit', // perbaikan data tempat (PRD 7.4)
  'link_edit', // ubah ketersediaan/catatan relasi
  'place_operational', // ubah status operasional tempat (PRD 9)
  'archive', // minta pengarsipan entitas
  'restore', // minta pemulihan publikasi
] as const;
export type CulinaryContributionKind =
  (typeof CULINARY_CONTRIBUTION_KINDS)[number];

export const CULINARY_CONTRIBUTION_STATUSES = [
  'pending',
  'needs_revision',
  'approved',
  'rejected',
] as const;
export type CulinaryContributionStatus =
  (typeof CULINARY_CONTRIBUTION_STATUSES)[number];

/**
* SEMUA pengajuan kuliner (PRD 6.5) dalam satu tabel discriminator `kind`
* (pola usaha_contributions). Target lintas entitas: `cuisine_id` untuk
* kuliner, `place_id` untuk tempat, `link_id` untuk relasi.
*
* Field-lock: `locked_fields` kanonik ter-sort. Overlap dengan pengajuan
* pending lain pada target sama = 409 (PRD 14).
*/
export const culinaryContributions = sqliteTable(
  'culinary_contributions',
  {
    id: text('id').primaryKey().$defaultFn(() => generateId()),
    kind: text('kind', { enum: CULINARY_CONTRIBUTION_KINDS }).notNull(),
    /** User sistem anonim untuk usulan tanpa login. */
    userId: text('user_id').notNull(),
    cuisineId: text('cuisine_id'),
    placeId: text('place_id'),
    linkId: text('link_id'),
    lockedFields: text('locked_fields').notNull().default(''),
    payloadJson: text('payload_json').notNull(),
    /** Stale check: updatedAt target saat pengajuan dibuat. */
    baseUpdatedAt: integer('base_updated_at', { mode: 'timestamp' }),
    status: text('status', { enum: CULINARY_CONTRIBUTION_STATUSES })
      .notNull()
      .default('pending'),
    /** Entitas resmi hasil approval (kind=new_cuisine/new_place). */
    resultCuisineId: text('result_cuisine_id'),
    resultPlaceId: text('result_place_id'),
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
    index('culinary_contributions_user_status_idx').on(t.userId, t.status),
    index('culinary_contributions_status_created_idx').on(t.status, t.createdAt),
    index('culinary_contributions_cuisine_idx').on(t.cuisineId, t.status),
    index('culinary_contributions_place_idx').on(t.placeId, t.status),
    index('culinary_contributions_kind_status_idx').on(t.kind, t.status),
  ],
);
