import type { Context } from 'hono';
import type { AppVariables } from '@/shared/types';
import { viewerKey } from '@/shared/http/viewer-key';
import type {
  GetArticleViewReportUseCase,
  ListArticleViewsUseCase,
  RecordArticleViewBySlugUseCase,
} from '../../application/use-cases/article-views.use-cases';

export class ArticleViewsController {
  constructor(
    private readonly recordBySlug: RecordArticleViewBySlugUseCase,
    private readonly listViews: ListArticleViewsUseCase,
    private readonly viewReport: GetArticleViewReportUseCase,
  ) {}

  recordViewBySlug(c: Context<{ Variables: AppVariables }>, slug: string) {
    return this.recordBySlug
      .execute(slug, viewerKey(c))
      .then(() => c.json({ success: true as const, data: null }));
  }

  listTotals(c: Context<{ Variables: AppVariables }>, days: number | null) {
    return this.listViews.execute(days).then((map) =>
      c.json({
        success: true as const,
        data: {
          items: [...map].map(([article_id, views]) => ({ article_id, views })),
        },
      }),
    );
  }

  listDaily(c: Context<{ Variables: AppVariables }>, days: number) {
    return this.viewReport.execute(days).then((report) =>
      c.json({
        success: true as const,
        data: {
          trend: report.trend,
          items: report.items.map((i) => ({
            article_id: i.articleId,
            name: i.name,
            slug: i.slug,
            category_name: i.categoryName,
            views: i.views,
            last_viewed: i.lastViewed,
          })),
        },
      }),
    );
  }
}