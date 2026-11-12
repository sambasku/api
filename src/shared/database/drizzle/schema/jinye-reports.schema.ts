import { sql } from 'drizzle-orm';
import {
  index,
  integer,
  sqliteTable,
  text,
  uniqueIndex,
} from 'drizzle-orm/sqlite-core';
import { generateId } from '@/shared/utils/ulid';

export const JINYE_REPORT_STATUSES = ['open', 'resolved', 'dismissed'] as const;
export type JinyeReportStatus = (typeof JINYE_REPORT_STATUSES)[number];

export const JINYE_REPORT_TARGETS = ['jinye', 'jinye_comment'] as const;
export type JinyeReportTarget = (typeof JINYE_REPORT_TARGETS)[number];

export const JINYE_REPORT_REASONS = [
  'inappropriate',
  'sexual',
  'harassment',
  'hate_speech',
  'spam',
  'other',
] as const;
export type JinyeReportReason = (typeof JINYE_REPORT_REASONS)[number];

export const JINYE_REPORT_RESOLUTIONS = ['dismissed', 'taken_down'] as const;
export type JinyeReportResolution = (typeof JINYE_REPORT_RESOLUTIONS)[number];

/**
 * Laporan pengguna atas Jinye / komen (pola pantun_reports).
 * Tidak otomatis mengubah konten - admin memutuskan nanti.
 */
export const jinyeReports = sqliteTable(
  'jinye_reports',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => generateId()),
    targetType: text('target_type', { enum: JINYE_REPORT_TARGETS }).notNull(),
    targetId: text('target_id').notNull(),
    userId: text('user_id').notNull(),
    reasonCode: text('reason_code', { enum: JINYE_REPORT_REASONS }).notNull(),
    note: text('note'),
    status: text('status', {
      enum: JINYE_REPORT_STATUSES,
    })
      .notNull()
      .default('open'),
    resolution: text('resolution', { enum: JINYE_REPORT_RESOLUTIONS }),
    resolutionNote: text('resolution_note'),
    resolvedBy: text('resolved_by'),
    resolvedAt: integer('resolved_at', { mode: 'timestamp' }),
    createdAt: integer('created_at', { mode: 'timestamp' })
      .notNull()
      .$defaultFn(() => new Date()),
    updatedAt: integer('updated_at', { mode: 'timestamp' }),
  },
  (t) => [
    index('jinye_reports_status_id_idx').on(t.status, t.id),
    index('jinye_reports_target_idx').on(t.targetType, t.targetId, t.status),
    uniqueIndex('jinye_reports_open_user_uidx')
      .on(t.targetType, t.targetId, t.userId)
      .where(sql`${t.status} = 'open'`),
  ],
);
