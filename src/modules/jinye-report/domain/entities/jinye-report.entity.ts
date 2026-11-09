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
