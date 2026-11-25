import type { Context } from 'hono';
import type { AppVariables } from '@/shared/types';
import type {
  ClearAdminWordOfDayUseCase,
  GetAdminWordOfDayUseCase,
  ListAdminWordOfDayHistoryUseCase,
  SetAdminWordOfDayUseCase,
} from '../../application/use-cases/admin-word-of-day.use-cases';

function toWire(view: {
  date: string;
  wordId: string | null;
  lemma: string | null;
  source: string;
  updatedAt: string | null;
  updatedBy: string | null;
}) {
  return {
    date: view.date,
    word_id: view.wordId,
    lemma: view.lemma,
    source: view.source,
    updated_at: view.updatedAt,
    updated_by: view.updatedBy,
  };
}

export class WordOfDayAdminController {
  constructor(
    private readonly deps: {
      get: GetAdminWordOfDayUseCase;
      listHistory: ListAdminWordOfDayHistoryUseCase;
      set: SetAdminWordOfDayUseCase;
      clear: ClearAdminWordOfDayUseCase;
    },
  ) {}

  async get(c: Context<{ Variables: AppVariables }>, query: { date?: string }) {
    const view = await this.deps.get.execute(query.date);
    return c.json({ success: true as const, data: toWire(view) });
  }

  async history(
    c: Context<{ Variables: AppVariables }>,
    query: { limit?: number },
  ) {
    const items = await this.deps.listHistory.execute(query.limit);
    return c.json({
      success: true as const,
      data: items.map((row) => ({
        date: row.date,
        word_id: row.wordId,
        lemma: row.lemma,
        source: row.source,
        updated_at: row.updatedAt,
        updated_by: row.updatedBy,
      })),
    });
  }

  async set(
    c: Context<{ Variables: AppVariables }>,
    body: { date: string; word_id: string },
  ) {
    const user = c.get('user');
    const view = await this.deps.set.execute({
      date: body.date,
      wordId: body.word_id,
      actorId: user!.user_id,
    });
    return c.json({ success: true as const, data: toWire(view) });
  }

  async clear(c: Context<{ Variables: AppVariables }>, query: { date: string }) {
    const user = c.get('user');
    await this.deps.clear.execute({ date: query.date, actorId: user!.user_id });
    return c.json({ success: true as const, data: null });
  }
}