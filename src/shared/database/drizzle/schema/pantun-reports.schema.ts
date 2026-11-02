import { sql } from 'drizzle-orm';
import {
  index,
  integer,
  sqliteTable,
  text,
  uniqueIndex,
} from 'drizzle-orm/sqlite-core';
import { generateId } from '@/shared/utils/ulid';

export const PANTUN_REPORT_STATUSES = ['open', 'resolved', 'dismissed'] as const;
export type PantunReportStatus = (typeof PANTUN_REPORT_STATUSES)[number];

/** Target laporan: pantun pembuka atau balasannya (polymorphic). */
export const PANTUN_REPORT_TARGETS = ['pantun', 'pantun_reply'] as const;
export type PantunReportTarget = (typeof PANTUN_REPORT_TARGETS)[number];

export const PANTUN_REPORT_REASONS = [
  'inappropriate', // tidak pantas
  'sexual', // konten seksual
  'harassment', // pelecehan/perundungan
  'hate_speech', // ujaran kebencian
  'spam', // spam/promosi
  'other', // wajib catatan
] as const;
export type PantunReportReason = (typeof PANTUN_REPORT_REASONS)[number];

export const PANTUN_REPORT_RESOLUTIONS = ['dismissed', 'taken_down'] as const;
export type PantunReportResolution = (typeof PANTUN_REPORT_RESOLUTIONS)[number];

/**
 * Laporan pengguna atas pantun/balasan (pola culinary_reports).
 * Laporan TIDAK otomatis mengubah konten - admin memutuskan.
 */
export const pantunReports = sqliteTable(
  'pantun_reports',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => generateId()),
    targetType: text('target_type', { enum: PANTUN_REPORT_TARGETS }).notNull(),
    targetId: text('target_id').notNull(),
    userId: text('user_id').notNull(),
    reasonCode: text('reason_code', { enum: PANTUN_REPORT_REASONS }).notNull(),
    note: text('note'),
    status: text('status', {
      enum: PANTUN_REPORT_STATUSES,
    })
      .notNull()
      .default('open'),
    resolution: text('resolution', { enum: PANTUN_REPORT_RESOLUTIONS }),
    resolutionNote: text('resolution_note'),
    resolvedBy: text('resolved_by'),
    resolvedAt: integer('resolved_at', { mode: 'timestamp' }),
    createdAt: integer('created_at', { mode: 'timestamp' })
      .notNull()
      .$defaultFn(() => new Date()),
    updatedAt: integer('updated_at', { mode: 'timestamp' }),
  },
  (t) => [
    index('pantun_reports_status_id_idx').on(t.status, t.id),
    index('pantun_reports_target_idx').on(t.targetType, t.targetId, t.status),
    uniqueIndex('pantun_reports_open_user_uidx')
      .on(t.targetType, t.targetId, t.userId)
      .where(sql`${t.status} = 'open'`),
  ],
);
