import type { Context } from 'hono';
import type { AuthUser } from '@/shared/types';
import type { ActivityItem } from '../../domain/entities/activity-item.entity';
import type { ListActivityUseCase } from '../../application/use-cases/list-activity.use-case';
import type { RecordCardShareUseCase } from '../../application/use-cases/record-card-share.use-case';
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
    announcement: item.announcement
      ? (() => {
          const a = item.announcement!;
          return {
            id: a.id,
            title: a.title,
            body: a.body,
            action_url: a.actionUrl,
            action_label: a.actionLabel,
            expired: a.expired,
          };
        })()
      : null,
  };
}

export class ActivityController {
  constructor(
    private readonly deps: { list: ListActivityUseCase; recordCardShare: RecordCardShareUseCase },
  ) {}

  async list(c: Context, query: ListActivityQuery) {
    // Flag hanya berguna kalau ada identitas nyata. Tanpa token sah (tamu, atau
    // token basi yang ditelan soft-auth) hasilnya `undefined` → feed publik
    // penuh. Tidak ada 400: `exclude_self` bukan gate, cuma preferensi tampilan.
    const viewerId = c.get('user')?.user_id;
    const excludeUserId = query.exclude_self === true ? viewerId : undefined;

    const page = await this.deps.list.execute({
      limit: query.limit,
      cursor: query.cursor,
      excludeUserId,
    });

    // Response jadi berbeda per identitas begitu `exclude_self` dipakai, jadi
    // cache per URL saja tidak boleh dipakai. Belum ada cache di API untuk route
    // ini; ini pagar buat nanti kalau ada CDN di depan.
    c.header('Vary', 'Authorization');
    return c.json({
      success: true as const,
      data: page.items.map(toWire),
      meta: {
        limit: query.limit,
        next_cursor: page.nextCursor,
        has_more: page.hasMore,
      },
    });
  }

  async recordCardShare(c: Context, wordId: string) {
    const user = c.get('user') as AuthUser;
    const { recorded } = await this.deps.recordCardShare.execute(user.user_id, wordId);
    return c.json({ success: true as const, data: { recorded } }, recorded ? 201 : 200);
  }
}
