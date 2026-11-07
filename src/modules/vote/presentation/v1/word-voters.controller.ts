import type { Context } from 'hono';
import type { AppVariables } from '@/shared/types';
import type { ListWordVotersUseCase } from '../../application/use-cases/list-word-voters.use-case';
import type {
  ListWordVotersParams,
  ListWordVotersQuery,
} from './validators/word-voters.validator';

type AdminCtx = Context<{ Variables: AppVariables }>;

export class WordVotersController {
  constructor(private readonly deps: { list: ListWordVotersUseCase }) {}

  async list(c: AdminCtx, params: ListWordVotersParams, query: ListWordVotersQuery) {
    const { items, meta } = await this.deps.list.execute({
      wordId: params.wordId,
      filter: {
        meaningId: query.meaning_id,
        value: (query.value as 1 | -1) ?? undefined,
      },
      limit: query.limit,
      cursor: query.cursor ?? null,
    });

    return c.json({
      success: true as const,
      data: items.map((v) => ({
        id: v.id,
        voter_id: v.userId,
        voter_username: v.voterUsername,
        voter_display_name: v.voterDisplayName,
        voter_avatar_url: v.voterAvatarUrl,
        voter_email: v.voterEmail,
        meaning_id: v.meaningId,
        meaning_preview: v.meaningPreview,
        value: v.value,
        created_at: v.createdAt.toISOString(),
      })),
      meta: {
        limit: meta.limit,
        next_cursor: meta.nextCursor,
        has_more: meta.hasMore,
        upvotes: meta.upvotes,
        downvotes: meta.downvotes,
      },
    });
  }
}
