import type { CursorPage } from '@/modules/word/domain/repositories/word.repository';
import type { JinyeReportWithTarget } from '../../domain/entities/jinye-report.entity';
import type {
  JinyeReportListFilter,
  JinyeReportRepository,
} from '../../domain/repositories/jinye-report.repository';

export class ListJinyeReportsUseCase {
  constructor(private readonly reports: JinyeReportRepository) {}

  execute(
    filter: JinyeReportListFilter,
  ): Promise<CursorPage<JinyeReportWithTarget>> {
    return this.reports.list(filter);
  }
}
