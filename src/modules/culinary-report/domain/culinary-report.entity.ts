import type {
  CulinaryReportReason,
  CulinaryReportStatus,
  CulinaryReportTarget,
} from '@/shared/database/drizzle/schema/culinary-reports.schema';

/** Laporan masyarakat atas data kuliner (PRD 4.1). Tidak mengubah data publik. */
export interface CulinaryReport {
  id: string;
  targetType: CulinaryReportTarget;
  targetId: string;
  userId: string;
  reasonCode: CulinaryReportReason | string;
  note: string | null;
  status: CulinaryReportStatus | string;
  resolution: string | null;
  resolutionNote: string | null;
  resolvedBy: string | null;
  resolvedAt: Date | null;
  createdAt: Date;
  updatedAt: Date | null;
}

export interface CulinaryReportWithTarget extends CulinaryReport {
  targetName: string | null;
  targetSlug: string | null;
}

export const CULINARY_REPORT_REASON_LABEL: Record<string, string> = {
  closed: 'Tempat sudah tutup',
  wrong_location: 'Lokasi tidak sesuai',
  invalid_contact: 'Kontak tidak valid',
  misleading: 'Informasi menyesatkan',
  duplicate: 'Dugaan duplikat',
  abuse: 'Dugaan pelanggaran',
};
