import type {
  KaryaViewReport,
  KaryaViewsRepository,
} from '../../domain/repositories/karya-views.repository';

export class RecordKaryaViewBySlugUseCase {
  constructor(private readonly repo: KaryaViewsRepository) {}

  execute(slug: string, viewerKey: string): Promise<void> {
    return this.repo.recordViewBySlug(slug, viewerKey);
  }
}

export class ListKaryaViewsUseCase {
  constructor(private readonly repo: KaryaViewsRepository) {}

  execute(days: number | null): Promise<Map<string, number>> {
    return this.repo.viewTotals(days);
  }
}

export class GetKaryaViewReportUseCase {
  constructor(private readonly repo: KaryaViewsRepository) {}

  execute(days: number): Promise<KaryaViewReport> {
    return this.repo.viewReport(days);
  }
}