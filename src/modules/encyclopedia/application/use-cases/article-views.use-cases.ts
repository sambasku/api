import type {
  ArticleViewReport,
  ArticleViewsRepository,
} from '../../domain/repositories/article-views.repository';

export class RecordArticleViewBySlugUseCase {
  constructor(private readonly repo: ArticleViewsRepository) {}

  execute(slug: string, viewerKey: string): Promise<void> {
    return this.repo.recordViewBySlug(slug, viewerKey);
  }
}

export class ListArticleViewsUseCase {
  constructor(private readonly repo: ArticleViewsRepository) {}

  execute(days: number | null): Promise<Map<string, number>> {
    return this.repo.viewTotals(days);
  }
}

export class GetArticleViewReportUseCase {
  constructor(private readonly repo: ArticleViewsRepository) {}

  execute(days: number): Promise<ArticleViewReport> {
    return this.repo.viewReport(days);
  }
}