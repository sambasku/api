import { index, integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';
import { generateId } from '@/shared/utils/ulid';

export const EVENT_CONTRIBUTION_STATUSES = [
  'pending',
  'needs_revision',
  'approved',
  'rejected',
] as const;

export type EventContributionStatus = (typeof EVENT_CONTRIBUTION_STATUSES)[number];

/**
 * Usulan acara dari pengguna (bisa anonim). Terpisah dari `events` supaya
 * usulan tidak pernah bocor ke API publik sebelum di-publish admin.
 *
 * Status:
 * - `pending`        menunggu pemeriksaan admin
 * - `needs_revision` perlu diperbaiki pengusul lalu dikirim ulang
 * - `approved`       sudah jadi event resmi (tidak diedit ulang)
 * - `rejected`       ditolak, alasannya tersimpan di `reject_reason_*`
 *
 * `payload_json` menyimpan data acara usulan apa adanya (kategori, jadwal,
 * lokasi, sumber) supaya data asli pengusul tetap utuh setelah disetujui.
 */
export const eventContributions = sqliteTable(
  'event_contributions',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => generateId()),
    userId: text('user_id').notNull(),
    /** Event resmi hasil approval. Null = 아직 usulan murni. */
    eventId: text('event_id'),
    payloadJson: text('payload_json').notNull(),
    status: text('status', { enum: EVENT_CONTRIBUTION_STATUSES })
      .notNull()
      .default('pending'),
    /** Catatan revisi dari admin (hanya saat status=needs_revision). */
    revisionNote: text('revision_note'),
    /** Alasan penolakan (hanya saat status=rejected). */
    rejectReasonCode: text('reject_reason_code'),
    rejectReasonText: text('reject_reason_text'),
    createdAt: integer('created_at', { mode: 'timestamp' })
      .notNull()
      .$defaultFn(() => new Date()),
    updatedAt: integer('updated_at', { mode: 'timestamp' }),
    reviewedAt: integer('reviewed_at', { mode: 'timestamp' }),
  },
  (t) => [
    index('event_contributions_user_status_idx').on(t.userId, t.status),
    index('event_contributions_status_created_idx').on(t.status, t.createdAt),
    index('event_contributions_event_id_idx').on(t.eventId),
  ],
);
