import type {
  UsahaViewReport,
  UsahaViewsRepository,
} from '../../domain/repositories/usaha-views.repository';

export class RecordUsahaViewBySlugUseCase {
  constructor(private readonly repo: UsahaViewsRepository) {}

  execute(slug: string, viewerKey: string): Promise<void> {
    return this.repo.recordViewBySlug(slug, viewerKey);
  }
}

export class ListUsahaViewsUseCase {
  constructor(private readonly repo: UsahaViewsRepository) {}

  execute(days: number | null): Promise<Map<string, number>> {
    return this.repo.viewTotals(days);
  }
}

export class GetUsahaViewReportUseCase {
  constructor(private readonly repo: UsahaViewsRepository) {}

  execute(days: number): Promise<UsahaViewReport> {
    return this.repo.viewReport(days);
  }
}