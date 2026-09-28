import type { Context } from 'hono';
import type { ActivityItem } from '../../domain/entities/activity-item.entity';
import type { ListActivityUseCase } from '../../application/use-cases/list-activity.use-case';
import type { ListActivityQuery } from './validators/activity.validator';

function toWire(item: ActivityItem) {
  return {
    id: item.id,
    kind: item.kind,
    created_at: item.createdAt.toISOString(),
    actor: item.actor
      ? {
          username: item.actor.username,
          display_name: item.actor.displayName,
          avatar_url: item.actor.avatarUrl,
        }
      : null,
    body: item.body,
    subtitle: item.subtitle,
    target: item.target,
  };
}

export class ActivityController {
  constructor(private readonly deps: { list: ListActivityUseCase }) {}

  async list(c: Context, query: ListActivityQuery) {
    const items = await this.deps.list.execute(query.limit);
    return c.json({
      success: true as const,
      data: items.map(toWire),
      meta: { limit: query.limit },
    });
  }
}
