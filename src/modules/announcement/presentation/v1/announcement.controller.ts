import type { Context } from 'hono';
import type { AppVariables } from '@/shared/types';
import type { Announcement } from '../../domain/entities/announcement.entity';
import type { ListAnnouncementsResult } from '../../domain/repositories/announcement.repository';
import type {
  CreateAnnouncementUseCase,
  DeleteAnnouncementUseCase,
  UpdateAnnouncementCommand,
} from '../../application/use-cases/announcement.use-cases';
import type { ListAnnouncementsUseCase } from '../../application/use-cases/list-announcements.use-case';

function serialize(a: Announcement) {
  return {
    id: a.id,
    title: a.title,
    body: a.body,
    action_url: a.actionUrl,
    action_label: a.actionLabel,
    created_by: a.createdBy,
    expires_at: a.expiresAt ? Math.floor(a.expiresAt.getTime() / 1000) : null,
    created_at: Math.floor(a.createdAt.getTime() / 1000),
    updated_at: a.updatedAt ? Math.floor(a.updatedAt.getTime() / 1000) : null,
  };
}

export class AnnouncementController {
  constructor(
    private readonly create: CreateAnnouncementUseCase,
    private readonly list: ListAnnouncementsUseCase,
    private readonly update: (cmd: UpdateAnnouncementCommand) => Promise<Announcement>,
    private readonly remove: DeleteAnnouncementUseCase,
  ) {}

  createAnnouncement(
    c: Context<{ Variables: AppVariables }>,
    body: { title: string; body: string; action_url?: string | null; action_label?: string | null; expires_at?: number | null },
  ) {
    const user = c.get('user')!;
    return this.create
      .execute({
        title: body.title,
        body: body.body,
        actionUrl: body.action_url ?? null,
        actionLabel: body.action_label ?? null,
        expiresAt: body.expires_at ? new Date(body.expires_at * 1000) : null,
        actorId: user.user_id,
        requestId: c.get('requestId'),
      })
      .then((a) => c.json({ success: true as const, data: serialize(a) }, 200));
  }

  listAnnouncements(
    c: Context<{ Variables: AppVariables }>,
    query: { limit: number; before?: string },
  ) {
    return this.list
      .execute({ limit: query.limit, before: query.before })
      .then((r: ListAnnouncementsResult) =>
        c.json({
          success: true as const,
          data: { items: r.items.map(serialize), next_cursor: r.nextCursor },
        }),
      );
  }

  updateAnnouncement(
    c: Context<{ Variables: AppVariables }>,
    id: string,
    body: { title?: string; body?: string; action_url?: string | null; action_label?: string | null; expires_at?: number | null },
  ) {
    const user = c.get('user')!;
    return this.update({
      id,
      title: body.title,
      body: body.body,
      actionUrl: body.action_url !== undefined ? body.action_url : undefined,
      actionLabel: body.action_label !== undefined ? body.action_label : undefined,
      expiresAt:
        body.expires_at === undefined
          ? undefined
          : body.expires_at
            ? new Date(body.expires_at * 1000)
            : null,
      actorId: user.user_id,
      requestId: c.get('requestId'),
    }).then((a) => c.json({ success: true as const, data: serialize(a) }, 200));
  }

  deleteAnnouncement(c: Context<{ Variables: AppVariables }>, id: string) {
    const user = c.get('user')!;
    return this.remove
      .execute({ id, actorId: user.user_id, requestId: c.get('requestId') })
      .then(() =>
        c.json({ success: true as const, data: null }, 200),
      );
  }
}
