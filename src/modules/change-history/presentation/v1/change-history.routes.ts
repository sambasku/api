import { createRoute } from '@hono/zod-openapi';
import { z } from 'zod';
import { rateLimit } from '@/shared/middlewares/rate-limit.middleware';
import { errorResponseSchema } from '@/shared/openapi/error-response.schema';
import { createOpenApiApp } from '@/shared/openapi/openapi-app';
import type { GetEntityChangeHistoryUseCase } from '../../application/get-entity-change-history.use-case';
import type { ExploreEntityType } from '../../domain/entity-change';

const json = <T extends z.ZodType>(schema: T) => ({ 'application/json': { schema } });

export const entityChangeHistoryResponseSchema = z.object({
  success: z.literal(true),
  data: z.array(
    z.object({
      id: z.string().length(26),
      timestamp: z.string(),
      actor: z.object({
        user_id: z.string().nullable(),
        username: z.string().nullable(),
        display_name: z.string().nullable(),
      }),
      action: z.string(),
      action_label: z.string(),
      changes: z.array(
        z.object({
          field: z.string(),
          label: z.string(),
          old_value: z.any().nullable(),
          new_value: z.any().nullable(),
          display_old: z.string(),
          display_new: z.string(),
        }),
      ),
      /** Ada = perubahan datang dari usulan yang disetujui. */
      source: z.object({ contribution_id: z.string() }).nullable(),
    }),
  ),
  meta: z.object({
    limit: z.number(),
    next_cursor: z.string().nullable(),
    has_more: z.boolean(),
  }),
});

const TAGS: Record<ExploreEntityType, string> = { place: 'Places', cuisine: 'Culinary' };

/**
 * PUBLIK: `GET /:slug/change-history` untuk satu jenis entitas eksplorasi.
 * Mount di prefix entitas (`/api/v1/places`, `/api/v1/culinary`, ...).
 */
export function createEntityChangeHistoryRoutes(deps: {
  entityType: ExploreEntityType;
  useCase: GetEntityChangeHistoryUseCase;
}) {
  const routes = createOpenApiApp();
  routes.use('*', rateLimit({ points: 100, duration: 60 }));

  const route = createRoute({
    method: 'get',
    path: '/:slug/change-history',
    tags: [TAGS[deps.entityType]],
    summary: 'Riwayat perubahan (timeline) - publik',
    request: {
      params: z.object({ slug: z.string().min(1).max(120) }),
      query: z.object({
        limit: z.coerce.number().int().min(1).max(100).default(20),
        cursor: z.string().length(26).optional(),
      }),
    },
    responses: {
      200: { description: 'Daftar riwayat', content: json(entityChangeHistoryResponseSchema) },
      404: { description: 'Tidak ditemukan', content: json(errorResponseSchema) },
    },
  });

  routes.openapi(route, (async (c: any) => {
    const { slug } = c.req.valid('param');
    const q = c.req.valid('query');
    const page = await deps.useCase.execute({
      entityType: deps.entityType,
      slug,
      limit: q.limit,
      cursor: q.cursor,
    });
    return c.json(
      entityChangeHistoryResponseSchema.parse({
        success: true,
        data: page.items.map((i) => ({
          id: i.id,
          timestamp: i.timestamp.toISOString(),
          actor: {
            user_id: i.actor.userId,
            username: i.actor.username,
            display_name: i.actor.displayName,
          },
          action: i.action,
          action_label: i.actionLabel,
          changes: i.changes.map((ch) => ({
            field: ch.field,
            label: ch.label,
            old_value: ch.oldValue,
            new_value: ch.newValue,
            display_old: ch.displayOld,
            display_new: ch.displayNew,
          })),
          source: i.sourceContributionId ? { contribution_id: i.sourceContributionId } : null,
        })),
        meta: { limit: q.limit, next_cursor: page.nextCursor, has_more: page.hasMore },
      }),
    );
  }) as never);

  return routes;
}
