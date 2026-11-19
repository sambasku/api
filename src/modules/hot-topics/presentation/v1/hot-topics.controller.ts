import type { Context } from 'hono';
import type { ListHotTopicsUseCase } from '../../application/list-hot-topics.use-case';
import type { HotTopicsQueryBody } from './validators/hot-topics.validator';

export class HotTopicsController {
  constructor(private readonly deps: { list: ListHotTopicsUseCase }) {}

  async list(c: Context, query: HotTopicsQueryBody) {
    const result = await this.deps.list.execute({ limit: query.limit });
    return c.json({
      success: true as const,
      data: {
        searched: {
          items: result.searched.items.map((i) => ({
            kind: i.kind,
            id: i.id,
            term: i.term,
            direction: i.direction,
            hit_count: i.hitCount,
            last_searched_at: i.lastSearchedAt.toISOString(),
            in_window: i.inWindow,
          })),
          meta: {
            in_window: result.searched.meta.inWindow,
            backfilled: result.searched.meta.backfilled,
            backfill_used: result.searched.meta.backfillUsed,
          },
        },
        proposed: {
          items: result.proposed.items.map((i) => ({
            kind: i.kind,
            id: i.id,
            word_id: i.wordId,
            lemma: i.lemma,
            created_at: i.createdAt.toISOString(),
            in_window: i.inWindow,
          })),
          meta: {
            in_window: result.proposed.meta.inWindow,
            backfilled: result.proposed.meta.backfilled,
            backfill_used: result.proposed.meta.backfillUsed,
          },
        },
        viewed: {
          items: result.viewed.items.map((i) => ({
            kind: i.kind,
            word_id: i.wordId,
            lemma: i.lemma,
            view_count: i.viewCount,
            last_viewed_day: i.lastViewedDay,
            in_window: i.inWindow,
          })),
          meta: {
            in_window: result.viewed.meta.inWindow,
            backfilled: result.viewed.meta.backfilled,
            backfill_used: result.viewed.meta.backfillUsed,
          },
        },
      },
    });
  }
}
