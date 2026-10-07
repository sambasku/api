import type { Context } from 'hono';
import { UnauthorizedError } from '@/shared/errors/app-error';
import type { AppVariables } from '@/shared/types';
import type { ProposeCategorySuggestionUseCase } from '../../application/use-cases/propose-category-suggestion.use-case';
import type { ListCategorySuggestionsUseCase } from '../../application/use-cases/list-category-suggestions.use-case';
import type {
  ApproveCategorySuggestionUseCase,
  RejectCategorySuggestionUseCase,
} from '../../application/use-cases/review-category-suggestion.use-case';
import type {
  ListCategorySuggestionsQuery,
  ProposeCategorySuggestionBody,
  ReviewCategorySuggestionBody,
} from './category-suggestion.dtos';

export class CategorySuggestionController {
  constructor(
    private readonly deps: {
      propose: ProposeCategorySuggestionUseCase;
      list: ListCategorySuggestionsUseCase;
      approve: ApproveCategorySuggestionUseCase;
      reject: RejectCategorySuggestionUseCase;
    },
  ) {}

  /** POST /api/v1/category-suggestions - login ATAU anonim (api#50) */
  async propose(c: Context, body: ProposeCategorySuggestionBody) {
    const actor = (c as Context<{ Variables: AppVariables }>).get('user');
    const item = await this.deps.propose.execute({
      name: body.name,
      reason: body.reason,
      proposedBy: actor?.user_id ?? null,
      contributorName: body.contributor_name ?? null,
      wordSuggestionId: null,
    });
    return c.json({ success: true as const, data: toApi(item) }, 201);
  }

  /** GET /api/v1/admin/category-suggestions - antrean moderasi (reviewer+) */
  async list(c: Context, query: ListCategorySuggestionsQuery) {
    const actor = (c as Context<{ Variables: AppVariables }>).get('user');
    if (!actor) throw new UnauthorizedError('UNAUTHORIZED', 'Token tidak disertakan');
    const items = await this.deps.list.execute({ status: query.status, limit: query.limit });
    return c.json({ success: true as const, data: items.map(toApi) });
  }

  /** PATCH /api/v1/admin/category-suggestions/:id/review - approve/reject */
  async review(c: Context, id: string, body: ReviewCategorySuggestionBody) {
    const actor = (c as Context<{ Variables: AppVariables }>).get('user');
    if (!actor) throw new UnauthorizedError('UNAUTHORIZED', 'Token tidak disertakan');
    const requestId = (c as Context<{ Variables: AppVariables }>).get('requestId');
    const item =
      body.action === 'approve'
        ? await this.deps.approve.execute({ suggestionId: id, reviewerId: actor.user_id, requestId })
        : await this.deps.reject.execute({
            suggestionId: id,
            reviewerId: actor.user_id,
            requestId,
            reason: body.reject_reason!,
          });
    return c.json({ success: true as const, data: toApi(item) });
  }
}

function toApi(item: {
  id: string;
  name: string;
  reason: string | null;
  status: string;
  proposedBy: string | null;
  contributorName: string | null;
  reviewedAt: Date | null;
  rejectReason: string | null;
  createdAt: Date;
}) {
  return {
    id: item.id,
    name: item.name,
    reason: item.reason,
    status: item.status,
    proposed_by: item.proposedBy,
    contributor_name: item.contributorName,
    reviewed_at: item.reviewedAt ? item.reviewedAt.toISOString() : null,
    reject_reason: item.rejectReason,
    created_at: item.createdAt.toISOString(),
  };
}
