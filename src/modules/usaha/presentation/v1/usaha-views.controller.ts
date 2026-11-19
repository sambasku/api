import type { Context } from 'hono';
import type { AppVariables } from '@/shared/types';
import { viewerKey } from '@/shared/http/viewer-key';
import type {
  GetUsahaViewReportUseCase,
  ListUsahaViewsUseCase,
  RecordUsahaViewBySlugUseCase,
} from '../../application/use-cases/usaha-views.use-cases';

export class UsahaViewsController {
  constructor(
    private readonly recordBySlug: RecordUsahaViewBySlugUseCase,
    private readonly listViews: ListUsahaViewsUseCase,
    private readonly viewReport: GetUsahaViewReportUseCase,
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
          items: [...map].map(([usaha_id, views]) => ({ usaha_id, views })),
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
            usaha_id: i.usahaId,
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