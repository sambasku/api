import { index, integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';
import { generateId } from '@/shared/utils/ulid';

export const USAHA_CONTRIBUTION_KINDS = [
  'new', // usulan usaha baru (bisa anonim)
  'profile', // perubahan profil usaha (pengelola)
  'item_add', // tambah item katalog
  'item_edit', // ubah item katalog
  'item_delete', // hapus item katalog
  'operational', // ubah status operasional
  'archive', // minta pengarsipan publikasi
  'restore', // minta pemulihan publikasi
] as const;
export type UsahaContributionKind = (typeof USAHA_CONTRIBUTION_KINDS)[number];

export const USAHA_CONTRIBUTION_STATUSES = [
  'pending',
  'needs_revision',
  'approved',
  'rejected',
] as const;
export type UsahaContributionStatus =
  (typeof USAHA_CONTRIBUTION_STATUSES)[number];

/**
 * SEMUA pengajuan usaha (PRD 10) dalam satu tabel dengan discriminator
 * `kind` - usulan baru + pengajuan pengelola (profil/katalog/operasional/
 * arsip). Terpisah dari `usahas` supaya data publik hanya pakai versi
 * yang sudah disetujui (PRD prinsip "Data publik terlindungi").
 *
 * Field-lock (PRD 10.1): `locked_fields` = daftar field yang diajukan,
 * kanonik ter-sort (mis. "name,phone"). Overlap dengan pengajuan pending
 * lain di usaha yang sama ditolak use-case (409) - bidang berbeda tetap
 * bebas diajukan.
 */
export const usahaContributions = sqliteTable(
  'usaha_contributions',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => generateId()),
    kind: text('kind', { enum: USAHA_CONTRIBUTION_KINDS }).notNull(),
    /** User sistem anonim untuk usulan tanpa login. */
    userId: text('user_id').notNull(),
    /** Target usaha. Null hanya untuk kind=new. */
    usahaId: text('usaha_id'),
    /** Target item katalog untuk item_edit/item_delete. */
    itemId: text('item_id'),
    /** Field yang diajukan (kanonik ter-sort) - dasar field-lock. */
    lockedFields: text('locked_fields').notNull().default(''),
    payloadJson: text('payload_json').notNull(),
    /** Stale check: updatedAt usaha saat pengajuan dibuat. */
    baseUpdatedAt: integer('base_updated_at', { mode: 'timestamp' }),
    status: text('status', { enum: USAHA_CONTRIBUTION_STATUSES })
      .notNull()
      .default('pending'),
    /** Kind=new: pengusul menandai "ini usaha saya" -> klaim dibuat saat approve. */
    wantsClaim: integer('wants_claim', { mode: 'boolean' })
      .notNull()
      .default(false),
    /** Usaha resmi hasil approval (kind=new). */
    resultUsahaId: text('result_usaha_id'),
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
    index('usaha_contributions_user_status_idx').on(t.userId, t.status),
    index('usaha_contributions_status_created_idx').on(t.status, t.createdAt),
    index('usaha_contributions_usaha_idx').on(t.usahaId, t.status),
    index('usaha_contributions_kind_status_idx').on(t.kind, t.status),
  ],
);
