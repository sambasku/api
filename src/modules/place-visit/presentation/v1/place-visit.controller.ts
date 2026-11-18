import type { Context } from 'hono';
import { logger } from '@/shared/logging/logger';
import { UnauthorizedError } from '@/shared/errors/app-error';
import type { AppVariables, AuthUser } from '@/shared/types';
import type {
  ListPlaceVisitsUseCase,
  MarkPlaceVisitUseCase,
  UnmarkPlaceVisitUseCase,
} from '../../application/use-cases/place-visit.use-cases';
import type {
  ListPlaceVisitsQuery,
  PlaceVisitParams,
} from './validators/place-visit.validator';

type Ctx = Context<{ Variables: AppVariables }>;

export class PlaceVisitController {
  constructor(
    private readonly deps: {
      mark: MarkPlaceVisitUseCase;
      unmark: UnmarkPlaceVisitUseCase;
      list: ListPlaceVisitsUseCase;
    },
  ) {}

  async mark(c: Ctx, params: PlaceVisitParams) {
    const user = this.requireUser(c);
    const result = await this.deps.mark.execute(user.user_id, params.id);
    logger.info(
      { request_id: c.get('requestId'), place_id: params.id, visit_count: result.visitCount },
      'place visit marked',
    );
    return c.json({
      success: true as const,
      data: {
        place_id: params.id,
        visit_count: result.visitCount,
        viewer_visited: result.viewerVisited,
      },
    });
  }

  async unmark(c: Ctx, params: PlaceVisitParams) {
    const user = this.requireUser(c);
    const result = await this.deps.unmark.execute(user.user_id, params.id);
    logger.info(
      { request_id: c.get('requestId'), place_id: params.id, visit_count: result.visitCount },
      'place visit unmarked',
    );
    return c.json({
      success: true as const,
      data: {
        place_id: params.id,
        visit_count: result.visitCount,
        viewer_visited: result.viewerVisited,
      },
    });
  }

  async listAdmin(c: Ctx, params: PlaceVisitParams, query: ListPlaceVisitsQuery) {
    const result = await this.deps.list.execute(params.id, {
      limit: query.limit,
      cursor: query.cursor,
    });
    return c.json({
      success: true as const,
      data: result.items.map((i) => ({
        id: i.id,
        user_id: i.userId,
        username: i.username,
        display_name: i.displayName,
        avatar_url: i.avatarUrl,
        created_at: i.createdAt.toISOString(),
      })),
      meta: {
        limit: query.limit,
        next_cursor: result.nextCursor,
        has_more: result.hasMore,
        total: result.total,
      },
    });
  }

  private requireUser(c: Ctx): AuthUser {
    const user = c.get('user');
    if (!user) throw new UnauthorizedError('UNAUTHORIZED', 'Token tidak disertakan');
    return user;
  }
}