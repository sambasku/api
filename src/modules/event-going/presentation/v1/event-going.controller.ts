import type { Context } from 'hono';
import { logger } from '@/shared/logging/logger';
import { UnauthorizedError } from '@/shared/errors/app-error';
import type { AppVariables, AuthUser } from '@/shared/types';
import type {
  ListEventGoingsUseCase,
  MarkEventGoingUseCase,
  UnmarkEventGoingUseCase,
} from '../../application/use-cases/event-going.use-cases';
import type {
  EventGoingParams,
  ListEventGoingsQuery,
} from './validators/event-going.validator';

type Ctx = Context<{ Variables: AppVariables }>;

export class EventGoingController {
  constructor(
    private readonly deps: {
      mark: MarkEventGoingUseCase;
      unmark: UnmarkEventGoingUseCase;
      list: ListEventGoingsUseCase;
    },
  ) {}

  async mark(c: Ctx, params: EventGoingParams) {
    const user = this.requireUser(c);
    const result = await this.deps.mark.execute(user.user_id, params.id);
    logger.info(
      { request_id: c.get('requestId'), event_id: params.id, going_count: result.goingCount },
      'event going marked',
    );
    return c.json({
      success: true as const,
      data: {
        event_id: params.id,
        going_count: result.goingCount,
        viewer_going: result.viewerGoing,
      },
    });
  }

  async unmark(c: Ctx, params: EventGoingParams) {
    const user = this.requireUser(c);
    const result = await this.deps.unmark.execute(user.user_id, params.id);
    logger.info(
      { request_id: c.get('requestId'), event_id: params.id, going_count: result.goingCount },
      'event going unmarked',
    );
    return c.json({
      success: true as const,
      data: {
        event_id: params.id,
        going_count: result.goingCount,
        viewer_going: result.viewerGoing,
      },
    });
  }

  async listAdmin(c: Ctx, params: EventGoingParams, query: ListEventGoingsQuery) {
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
