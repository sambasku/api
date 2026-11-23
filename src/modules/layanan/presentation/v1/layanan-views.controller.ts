import type { Context } from 'hono';
import type { AppVariables } from '@/shared/types';
import { viewerKey } from '@/shared/http/viewer-key';
import type {
  GetLayananViewReportUseCase,
  ListLayananViewsUseCase,
  RecordLayananViewBySlugUseCase,
} from '../../application/use-cases/layanan-views.use-cases';

export class LayananViewsController {
  constructor(
    private readonly recordBySlug: RecordLayananViewBySlugUseCase,
    private readonly listViews: ListLayananViewsUseCase,
    private readonly viewReport: GetLayananViewReportUseCase,
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
          items: [...map].map(([layanan_id, views]) => ({ layanan_id, views })),
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
            layanan_id: i.layananId,
            name: i.name,
            slug: i.slug,
            category: i.category,
            views: i.views,
            last_viewed: i.lastViewed,
          })),
        },
      }),
    );
  }
}