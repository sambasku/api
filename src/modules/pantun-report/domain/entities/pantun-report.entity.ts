import type {
  PantunReportReason,
  PantunReportResolution,
  PantunReportStatus,
  PantunReportTarget,
} from '@/shared/database/drizzle/schema/pantun-reports.schema';

/** Laporan pengguna atas pantun/balasan. Tidak mengubah konten publik. */
export interface PantunReport {
  id: string;
  targetType: PantunReportTarget;
  targetId: string;
  userId: string;
  username: string | null;
  displayName: string | null;
  reasonCode: PantunReportReason;
  note: string | null;
  status: PantunReportStatus;
  resolution: PantunReportResolution | null;
  resolutionNote: string | null;
  resolvedBy: string | null;
  resolvedAt: Date | null;
  createdAt: Date;
  updatedAt: Date | null;
}

/** Laporan + snapshot target (diisi LEFT JOIN, satu query). */
export interface PantunReportWithTarget extends PantunReport {
  targetLines: string[] | null;
  targetStatus: string | null;
  targetUserId: string | null;
  targetUsername: string | null;
  targetDisplayName: string | null;
}

export const PANTUN_REPORT_REASON_LABEL: Record<string, string> = {
  inappropriate: 'Tidak pantas',
  sexual: 'Konten seksual',
  harassment: 'Pelecehan atau perundungan',
  hate_speech: 'Ujaran kebencian',
  spam: 'Spam',
  other: 'Lainnya',
};
