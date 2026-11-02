import type { CursorPage } from '@/modules/word/domain/repositories/word.repository';
import type { PantunReportTarget } from '@/shared/database/drizzle/schema/pantun-reports.schema';
import type { PantunReportStatus } from '@/shared/database/drizzle/schema/pantun-reports.schema';
import type {
  PantunReport,
  PantunReportWithTarget,
} from '../entities/pantun-report.entity';

export interface PantunReportListFilter {
  status?: PantunReportStatus;
  limit: number;
  cursor?: string;
}

export interface PantunReportRepository {
  create(input: {
    targetType: PantunReportTarget;
    targetId: string;
    userId: string;
    reasonCode: string;
    note?: string | null;
  }): Promise<PantunReport>;
  findById(id: string): Promise<PantunReportWithTarget | null>;
  findOpenByUser(
    targetType: PantunReportTarget,
    targetId: string,
    userId: string,
  ): Promise<PantunReport | null>;
  list(filter: PantunReportListFilter): Promise<CursorPage<PantunReportWithTarget>>;
  /** Tutup satu laporan (hanya bila masih open). */
  resolve(input: {
    id: string;
    status: 'resolved' | 'dismissed';
    resolution: 'dismissed' | 'taken_down';
    resolutionNote?: string | null;
    resolvedBy: string;
  }): Promise<boolean>;
  /** Takedown: tutup semua laporan open pada target yang sama. */
  resolveAllOpenForTarget(input: {
    targetType: PantunReportTarget;
    targetId: string;
    resolutionNote?: string | null;
    resolvedBy: string;
  }): Promise<void>;
}
