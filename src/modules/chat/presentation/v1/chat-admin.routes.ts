import type { MiddlewareHandler } from 'hono';
import { createRoute } from '@hono/zod-openapi';
import { z } from 'zod';
import { createOpenApiApp } from '@/shared/openapi/openapi-app';
import { errorResponseSchema } from '@/shared/openapi/error-response.schema';
import { requireMinRole } from '@/shared/middlewares/authorize-role.middleware';
import type { AppVariables } from '@/shared/types';
import type { GetChatModerationSnapshotUseCase } from '../../application/use-cases/chat.use-cases';
import type { ChatMessageModerationSnapshot } from '../../domain/entities/chat-message.entity';
import { chatMessageIdParamSchema } from './validators/chat.validator';

const json = <T extends z.ZodType>(schema: T) => ({
  'application/json': { schema },
});

const moderationSnapshotWireSchema = z.object({
  message_id: z.string(),
  user_id: z.string(),
  username: z.string().nullable(),
  display_name: z.string().nullable(),
  kind: z.enum(['text', 'sticker', 'voice_note', 'system']),
  body: z.string().nullable(),
  sticker_id: z.string().nullable(),
  reply_to_id: z.string().nullable(),
  reply_snippet: z.string().nullable(),
  revisions: z.array(
    z.object({
      body: z.string(),
      editor_id: z.string(),
      created_at: z.string(),
    }),
  ),
  message_created_at: z.string(),
  deleted_at: z.string(),
  deleted_by: z.string(),
  deletion_reason: z.string().nullable(),
  snapshot_at: z.string(),
});

const moderationSnapshotResponseSchema = z.object({
  success: z.literal(true),
  data: moderationSnapshotWireSchema,
});

function serializeSnapshot(s: ChatMessageModerationSnapshot) {
  return {
    message_id: s.messageId,
    user_id: s.userId,
    username: s.username,
    display_name: s.displayName,
    kind: s.kind,
    body: s.body,
    sticker_id: s.stickerId,
    reply_to_id: s.replyToId,
    reply_snippet: s.replySnippet,
    revisions: s.revisions,
    message_created_at: s.messageCreatedAt.toISOString(),
    deleted_at: s.deletedAt.toISOString(),
    deleted_by: s.deletedBy,
    deletion_reason: s.deletionReason,
    snapshot_at: s.snapshotAt.toISOString(),
  };
}

export interface ChatAdminRoutesDeps {
  getSnapshot: GetChatModerationSnapshotUseCase;
  authenticate: MiddlewareHandler<{ Variables: AppVariables }>;
}

/**
 * GET /api/v1/admin/chat/messages/:id/snapshot - admin/root.
 * Salinan isi pesan + riwayat suntingan sebelum dihapus. Tidak untuk pengguna.
 */
export function createChatAdminRoutes(deps: ChatAdminRoutesDeps) {
  const routes = createOpenApiApp();

  routes.use('*', deps.authenticate);
  routes.use('*', requireMinRole('admin'));

  const snapshotRoute = createRoute({
    method: 'get',
    path: '/messages/{id}/snapshot',
    tags: ['Admin Chat'],
    summary: 'Salinan moderasi pesan chat terhapus (admin/root, diaudit)',
    request: { params: chatMessageIdParamSchema },
    responses: {
      200: {
        description: 'Salinan moderasi',
        content: json(moderationSnapshotResponseSchema),
      },
      401: {
        description: 'Token tidak ada/invalid',
        content: json(errorResponseSchema),
      },
      403: {
        description: 'Bukan admin/root',
        content: json(errorResponseSchema),
      },
      404: {
        description: 'Salinan tidak ditemukan (pesan belum pernah dihapus)',
        content: json(errorResponseSchema),
      },
    },
  });

  routes.openapi(snapshotRoute, async (c) => {
    const user = c.get('user')!;
    const snapshot = await deps.getSnapshot.execute({
      messageId: c.req.valid('param').id,
      actorId: user.user_id,
      requestId: c.get('requestId'),
    });
    return c.json(
      { success: true as const, data: serializeSnapshot(snapshot) },
      200,
    ) as never;
  });

  return routes;
}
