import type { UsahaReportReason } from '@/shared/database/drizzle/schema/usaha-reports.schema';
import type { UsahaReportStatus } from '@/shared/database/drizzle/schema/usaha-reports.schema';

export interface UsahaReport {
  id: string;
  usahaId: string;
  userId: string;
  reasonCode: UsahaReportReason | string;
  note: string | null;
  status: UsahaReportStatus | string;
  resolution: string | null;
  resolutionNote: string | null;
  resolvedBy: string | null;
  resolvedAt: Date | null;
  createdAt: Date;
  updatedAt: Date | null;
}

export interface UsahaReportWithUsaha extends UsahaReport {
  usahaName: string;
  usahaSlug: string;
}

export const USAHA_REPORT_REASON_LABEL: Record<string, string> = {
  closed: 'Usaha sudah tutup',
  wrong_location: 'Lokasi tidak sesuai',
  invalid_contact: 'Kontak tidak valid',
  misleading: 'Informasi menyesatkan',
  duplicate: 'Dugaan duplikat',
  abuse: 'Dugaan pelanggaran',
};
