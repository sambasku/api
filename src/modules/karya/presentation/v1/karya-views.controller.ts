import type { Context } from 'hono';
import type { AppVariables } from '@/shared/types';
import { viewerKey } from '@/shared/http/viewer-key';
import type {
  GetKaryaViewReportUseCase,
  ListKaryaViewsUseCase,
  RecordKaryaViewBySlugUseCase,
} from '../../application/use-cases/karya-views.use-cases';

export class KaryaViewsController {
  constructor(
    private readonly recordBySlug: RecordKaryaViewBySlugUseCase,
    private readonly listViews: ListKaryaViewsUseCase,
    private readonly viewReport: GetKaryaViewReportUseCase,
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
          items: [...map].map(([karya_id, views]) => ({ karya_id, views })),
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
            karya_id: i.karyaId,
            title: i.title,
            slug: i.slug,
            kind: i.kind,
            views: i.views,
            last_viewed: i.lastViewed,
          })),
        },
      }),
    );
  }
}