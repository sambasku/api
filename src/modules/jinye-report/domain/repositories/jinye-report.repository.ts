import type { CursorPage } from '@/modules/word/domain/repositories/word.repository';
import type {
  JinyeReportStatus,
  JinyeReportTarget,
} from '@/shared/database/drizzle/schema/jinye-reports.schema';
import type {
  JinyeReport,
  JinyeReportWithTarget,
} from '../entities/jinye-report.entity';

export interface JinyeReportListFilter {
  status?: JinyeReportStatus;
  limit: number;
  cursor?: string;
}

export interface JinyeReportRepository {
  create(input: {
    targetType: JinyeReportTarget;
    targetId: string;
    userId: string;
    reasonCode: string;
    note?: string | null;
  }): Promise<JinyeReport>;
  findById(id: string): Promise<JinyeReportWithTarget | null>;
  findOpenByUser(
    targetType: JinyeReportTarget,
    targetId: string,
    userId: string,
  ): Promise<JinyeReport | null>;
  list(filter: JinyeReportListFilter): Promise<CursorPage<JinyeReportWithTarget>>;
  resolve(input: {
    id: string;
    status: 'resolved' | 'dismissed';
    resolution: 'dismissed' | 'taken_down';
    resolutionNote?: string | null;
    resolvedBy: string;
  }): Promise<boolean>;
  resolveAllOpenForTarget(input: {
    targetType: JinyeReportTarget;
    targetId: string;
    resolutionNote?: string | null;
    resolvedBy: string;
  }): Promise<void>;
}
