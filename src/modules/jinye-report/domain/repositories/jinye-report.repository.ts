import type { JinyeReportTarget } from '@/shared/database/drizzle/schema/jinye-reports.schema';
import type { JinyeReport } from '../entities/jinye-report.entity';

export interface JinyeReportRepository {
  create(input: {
    targetType: JinyeReportTarget;
    targetId: string;
    userId: string;
    reasonCode: string;
    note?: string | null;
  }): Promise<JinyeReport>;
  findOpenByUser(
    targetType: JinyeReportTarget,
    targetId: string,
    userId: string,
  ): Promise<JinyeReport | null>;
}
