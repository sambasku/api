import type { CursorPage } from '@/modules/word/domain/repositories/word.repository';
import type { PantunReportWithTarget } from '../../domain/entities/pantun-report.entity';
import type {
  PantunReportListFilter,
  PantunReportRepository,
} from '../../domain/repositories/pantun-report.repository';

export class ListPantunReportsUseCase {
  constructor(private readonly reports: PantunReportRepository) {}

  execute(
    filter: PantunReportListFilter,
  ): Promise<CursorPage<PantunReportWithTarget>> {
    return this.reports.list(filter);
  }
}
