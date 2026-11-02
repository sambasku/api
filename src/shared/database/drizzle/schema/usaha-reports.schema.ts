import { sql } from 'drizzle-orm';
import {
  index,
  integer,
  sqliteTable,
  text,
  uniqueIndex,
} from 'drizzle-orm/sqlite-core';
import { generateId } from '@/shared/utils/ulid';

export const USAHA_REPORT_STATUSES = ['open', 'resolved', 'dismissed'] as const;
export type UsahaReportStatus = (typeof USAHA_REPORT_STATUSES)[number];

export const USAHA_REPORT_REASONS = [
  'closed', // usaha sudah tutup
  'wrong_location', // lokasi tidak sesuai
  'invalid_contact', // kontak tidak valid
  'misleading', // informasi profil menyesatkan
  'duplicate', // dugaan duplikat
  'abuse', // dugaan pelanggaran/penyalahgunaan
] as const;
export type UsahaReportReason = (typeof USAHA_REPORT_REASONS)[number];

/**
 * Laporan masyarakat atas info usaha (PRD 13) - pola word_reports.
 * Laporan TIDAK otomatis mengubah status operasional/publikasi; admin
 * memutuskan lewat antrean resolve.
 */
export const usahaReports = sqliteTable(
  'usaha_reports',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => generateId()),
    usahaId: text('usaha_id').notNull(),
    userId: text('user_id').notNull(),
    reasonCode: text('reason_code').notNull(),
    note: text('note'),
    /** open | resolved | dismissed */
    status: text('status').notNull().default('open'),
    resolution: text('resolution'),
    resolutionNote: text('resolution_note'),
    resolvedBy: text('resolved_by'),
    resolvedAt: integer('resolved_at', { mode: 'timestamp' }),
    createdAt: integer('created_at', { mode: 'timestamp' })
      .notNull()
      .$defaultFn(() => new Date()),
    updatedAt: integer('updated_at', { mode: 'timestamp' }),
  },
  (t) => [
    index('usaha_reports_status_id_idx').on(t.status, t.id),
    index('usaha_reports_usaha_idx').on(t.usahaId, t.status),
    // Satu laporan open per (usaha, pelapor).
    uniqueIndex('usaha_reports_open_user_uidx')
      .on(t.usahaId, t.userId)
      .where(sql`${t.status} = 'open'`),
  ],
);
