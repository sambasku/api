import type { Context } from 'hono';
import type { AppVariables } from '@/shared/types';
import {
  clientIpKey,
  normalizedDeviceId,
} from '@/shared/middlewares/rate-limit.middleware';
import type {
  GetWordViewReportUseCase,
  ListWordViewsUseCase,
  RecordWordViewByIdUseCase,
  RecordWordViewByLemmaUseCase,
} from '../../application/use-cases/word-views.use-cases';

function viewerKey(c: Context<{ Variables: AppVariables }>): string {
  const userId = c.get('user')?.user_id;
  if (userId) return `u:${userId}`;
  const deviceId = normalizedDeviceId(c);
  if (deviceId) return `d:${deviceId}`;
  return `ip:${clientIpKey(c)}`;
}

export class WordViewsController {
  constructor(
    private readonly recordById: RecordWordViewByIdUseCase,
    private readonly recordByLemma: RecordWordViewByLemmaUseCase,
    private readonly listViews: ListWordViewsUseCase,
    private readonly viewReport: GetWordViewReportUseCase,
  ) {}

  recordViewById(c: Context<{ Variables: AppVariables }>, wordId: string) {
    return this.recordById
      .execute(wordId, viewerKey(c))
      .then(() => c.json({ success: true as const, data: null }));
  }

  recordViewByLemma(c: Context<{ Variables: AppVariables }>, lemma: string) {
    return this.recordByLemma
      .execute(lemma, viewerKey(c))
      .then(() => c.json({ success: true as const, data: null }));
  }

  listTotals(c: Context<{ Variables: AppVariables }>, days: number | null) {
    return this.listViews.execute(days).then((map) =>
      c.json({
        success: true as const,
        data: {
          items: [...map].map(([word_id, views]) => ({ word_id, views })),
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
            word_id: i.wordId,
            lemma: i.lemma,
            views: i.views,
            last_viewed: i.lastViewed,
          })),
        },
      }),
    );
  }
}
