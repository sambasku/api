import type { Context } from 'hono';
import type { AppVariables } from '@/shared/types';
import { viewerKey } from '@/shared/http/viewer-key';
import type {
  GetCuisineViewReportUseCase,
  ListCuisineViewsUseCase,
  RecordCuisineViewBySlugUseCase,
} from '../../application/use-cases/cuisine-views.use-cases';

export class CuisineViewsController {
  constructor(
    private readonly recordBySlug: RecordCuisineViewBySlugUseCase,
    private readonly listViews: ListCuisineViewsUseCase,
    private readonly viewReport: GetCuisineViewReportUseCase,
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
          items: [...map].map(([cuisine_id, views]) => ({ cuisine_id, views })),
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
            cuisine_id: i.cuisineId,
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