import type {
  JinyeReportReason,
  JinyeReportResolution,
  JinyeReportStatus,
  JinyeReportTarget,
} from '@/shared/database/drizzle/schema/jinye-reports.schema';

export interface JinyeReport {
  id: string;
  targetType: JinyeReportTarget;
  targetId: string;
  userId: string;
  username: string | null;
  displayName: string | null;
  reasonCode: JinyeReportReason;
  note: string | null;
  status: JinyeReportStatus;
  resolution: JinyeReportResolution | null;
  resolutionNote: string | null;
  resolvedBy: string | null;
  resolvedAt: Date | null;
  createdAt: Date;
  updatedAt: Date | null;
}

/** Laporan + snapshot target (LEFT JOIN, satu query). */
export interface JinyeReportWithTarget extends JinyeReport {
  targetBody: string | null;
  targetHasImages: boolean;
  targetHasAudio: boolean;
  targetStatus: string | null;
  targetUserId: string | null;
  targetUsername: string | null;
  targetDisplayName: string | null;
}

export const JINYE_REPORT_REASON_LABEL: Record<string, string> = {
  inappropriate: 'Tidak pantas',
  sexual: 'Konten seksual',
  harassment: 'Pelecehan atau perundungan',
  hate_speech: 'Ujaran kebencian',
  spam: 'Spam',
  other: 'Lainnya',
};
