import type {
  LayananViewReport,
  LayananViewsRepository,
} from '../../domain/repositories/layanan-views.repository';

export class RecordLayananViewBySlugUseCase {
  constructor(private readonly repo: LayananViewsRepository) {}

  execute(slug: string, viewerKey: string): Promise<void> {
    return this.repo.recordViewBySlug(slug, viewerKey);
  }
}

export class ListLayananViewsUseCase {
  constructor(private readonly repo: LayananViewsRepository) {}

  execute(days: number | null): Promise<Map<string, number>> {
    return this.repo.viewTotals(days);
  }
}

export class GetLayananViewReportUseCase {
  constructor(private readonly repo: LayananViewsRepository) {}

  execute(days: number): Promise<LayananViewReport> {
    return this.repo.viewReport(days);
  }
}