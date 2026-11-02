import type { MiddlewareHandler } from 'hono';
import { createRoute } from '@hono/zod-openapi';
import { z } from 'zod';
import { rateLimit } from '@/shared/middlewares/rate-limit.middleware';
import { createOpenApiApp } from '@/shared/openapi/openapi-app';
import type { AppVariables } from '@/shared/types';
import type { ListMyUsahaUseCase } from '../../application/use-cases/list-my-usaha.use-case';
import { usahaResponseSchema } from './validators/usaha.validator';

const myUsahaItemSchema = usahaResponseSchema.extend({
  pending_changes: z.number(),
});

const okList = z.object({
  success: z.literal(true),
  data: z.object({
    items: z.array(myUsahaItemSchema),
    pending_claim_count: z.number(),
  }),
});

/**
 * `GET /usaha/mine` - Usaha Saya (PRD 9). Router terpisah karena HARUS
 * didaftarkan SEBELUM `/usaha/:slug` supaya "mine" tidak tertelan param.
 */
export function createUsahaMineRoutes(deps: {
  listMyUc: ListMyUsahaUseCase;
  authenticate: MiddlewareHandler<{ Variables: AppVariables }>;
}) {
  const routes = createOpenApiApp();
  // Scope ke `/mine` saja: sub-app ini di-mount di `/api/v1/usaha`, jadi
  // `use('*')` akan membajak seluruh prefix (list/detail publik jadi 401).
  routes.use('/mine', rateLimit({ points: 60, duration: 60 }));
  routes.use('/mine', deps.authenticate);

  const mineRoute = createRoute({
    method: 'get',
    path: '/mine',
    tags: ['Usaha'],
    summary: 'Usaha yang saya kelola + ringkasan pengajuan pending',
    responses: {
      200: {
        description: 'Daftar usaha kelolaan',
        content: { 'application/json': { schema: okList } },
      },
    },
  });

  routes.openapi(mineRoute, (c) => {
    const userId = c.get('user')?.user_id ?? '';
    return deps.listMyUc.execute(userId).then((res) =>
      c.json({
        success: true as const,
        data: {
          items: res.items.map((u) => ({
            id: u.id,
            slug: u.slug,
            name: u.name,
            description: u.description,
            category_id: u.categoryId,
            category: u.category,
            kind: u.kind,
            region_id: u.regionId,
            village_id: u.villageId,
            village: u.village,
            address_text: u.addressText,
            lat: u.lat,
            lng: u.lng,
            maps_url: u.mapsUrl,
            phone: u.phone,
            whatsapp: u.whatsapp,
            website: u.website,
            social_url: u.socialUrl,
            cover_url: u.coverUrl,
            publish_status: u.publishStatus,
            operational_status: u.operationalStatus,
            restricted_reason: u.restrictedReason,
            restricted_at: u.restrictedAt ? u.restrictedAt.toISOString() : null,
            manager_id: u.managerId,
            author_id: u.authorId,
            published_at: u.publishedAt ? u.publishedAt.toISOString() : null,
            created_at: u.createdAt.toISOString(),
            updated_at: u.updatedAt ? u.updatedAt.toISOString() : null,
            pending_changes: u.pending_changes,
          })),
          pending_claim_count: res.pending_claim_count,
        },
      }),
    );
  });
  return routes;
}
