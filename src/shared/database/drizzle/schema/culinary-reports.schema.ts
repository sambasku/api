import { sql } from 'drizzle-orm';
import {
  index,
  integer,
  sqliteTable,
  text,
  uniqueIndex,
} from 'drizzle-orm/sqlite-core';
import { generateId } from '@/shared/utils/ulid';

export const CULINARY_REPORT_STATUSES = ['open', 'resolved', 'dismissed'] as const;
export type CulinaryReportStatus = (typeof CULINARY_REPORT_STATUSES)[number];

export const CULINARY_REPORT_REASONS = [
  'closed', // tempat sudah tutup
  'wrong_location', // lokasi tidak sesuai
  'invalid_contact', // kontak tidak valid
  'misleading', // informasi menyesatkan
  'duplicate', // dugaan duplikat
  'abuse', // dugaan pelanggaran
] as const;
export type CulinaryReportReason = (typeof CULINARY_REPORT_REASONS)[number];

/** Target laporan: entitas kuliner atau tempat (PRD 4.1 "pelaporan data"). */
export const CULINARY_REPORT_TARGETS = ['cuisine', 'place'] as const;
export type CulinaryReportTarget = (typeof CULINARY_REPORT_TARGETS)[number];

/**
* Laporan masyarakat atas data kuliner (pola word_reports/usaha_reports).
* Laporan TIDAK otomatis mengubah data publik - admin memutuskan.
*/
export const culinaryReports = sqliteTable(
  'culinary_reports',
  {
    id: text('id').primaryKey().$defaultFn(() => generateId()),
    targetType: text('target_type', { enum: CULINARY_REPORT_TARGETS }).notNull(),
    targetId: text('target_id').notNull(),
    userId: text('user_id').notNull(),
    reasonCode: text('reason_code').notNull(),
    note: text('note'),
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
    index('culinary_reports_status_id_idx').on(t.status, t.id),
    index('culinary_reports_target_idx').on(t.targetType, t.targetId, t.status),
    uniqueIndex('culinary_reports_open_user_uidx')
      .on(t.targetType, t.targetId, t.userId)
      .where(sql`${t.status} = 'open'`),
  ],
);
