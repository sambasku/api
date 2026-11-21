import type {
  CuisineViewReport,
  CuisineViewsRepository,
} from '../../domain/repositories/cuisine-views.repository';

export class RecordCuisineViewBySlugUseCase {
  constructor(private readonly repo: CuisineViewsRepository) {}

  execute(slug: string, viewerKey: string): Promise<void> {
    return this.repo.recordViewBySlug(slug, viewerKey);
  }
}

export class ListCuisineViewsUseCase {
  constructor(private readonly repo: CuisineViewsRepository) {}

  execute(days: number | null): Promise<Map<string, number>> {
    return this.repo.viewTotals(days);
  }
}

export class GetCuisineViewReportUseCase {
  constructor(private readonly repo: CuisineViewsRepository) {}

  execute(days: number): Promise<CuisineViewReport> {
    return this.repo.viewReport(days);
  }
}