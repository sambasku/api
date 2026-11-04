import { sql } from 'drizzle-orm';
import { index, integer, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core';
import { generateId } from '@/shared/utils/ulid';

export const USAHA_CLAIM_STATUSES = [
  'pending',
  'approved',
  'rejected',
  'cancelled',
] as const;
export type UsahaClaimStatus = (typeof USAHA_CLAIM_STATUSES)[number];

export const USAHA_CLAIM_REJECT_REASONS = [
  'evidence_insufficient',
  'claim_conflict',
  'not_owner',
  'other',
] as const;
export type UsahaClaimRejectReason = (typeof USAHA_CLAIM_REJECT_REASONS)[number];

/**
 * Klaim pengelolaan usaha (PRD 8). Wajib login; semua klaim ditinjau admin.
 *
 * Bukti verifikasi PRIVAT (`evidence_images` + legacy `contact_evidence`) -
 * tidak pernah diserialkan di endpoint publik (hanya antrean admin).
 *
 * Konflik sederhana: satu klaim pending per (usaha, user). Saat satu klaim
 * disetujui, klaim pending lain untuk usaha yang sama auto-reject
 * (`claim_conflict`) - PRD 8 dipenuhi tanpa alur khusus.
 */
export const usahaClaims = sqliteTable(
  'usaha_claims',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => generateId()),
    usahaId: text('usaha_id').notNull(),
    userId: text('user_id').notNull(),
    /**
     * Legacy teks bukti. Klaim baru boleh string kosong bila
     * `evidence_images` terisi.
     */
    contactEvidence: text('contact_evidence').notNull().default(''),
    /**
     * Bukti gambar ImageKit (privat). JSON
     * `{ url, provider_file_id, alt_text? }[]`.
     */
    evidenceImages: text('evidence_images').notNull().default('[]'),
    note: text('note'),
    status: text('status', { enum: USAHA_CLAIM_STATUSES })
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
    index('usaha_claims_usaha_status_idx').on(t.usahaId, t.status),
    index('usaha_claims_user_idx').on(t.userId, t.status),
    uniqueIndex('usaha_claims_pending_user_uidx')
      .on(t.usahaId, t.userId)
      .where(sql`${t.status} = 'pending'`),
  ],
);