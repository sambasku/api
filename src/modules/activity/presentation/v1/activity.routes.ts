import { createRoute } from '@hono/zod-openapi';
import { z } from 'zod';
import { rateLimit } from '@/shared/middlewares/rate-limit.middleware';
import { createOpenApiApp } from '@/shared/openapi/openapi-app';
import { errorResponseSchema } from '@/shared/openapi/error-response.schema';
import type { ActivityController } from './activity.controller';
import {
  listActivityQuerySchema,
  listActivityResponseSchema,
} from './validators/activity.validator';

const json = <T extends z.ZodType>(schema: T) => ({
  'application/json': { schema },
});

/** GET /api/v1/activity - feed lintas aktivitas publik (37-api). */
export function createActivityRoutes(deps: { controller: ActivityController }) {
  const routes = createOpenApiApp();
  routes.use('*', rateLimit({ points: 100, duration: 60 }));

  const listRoute = createRoute({
    method: 'get',
    path: '/',
    tags: ['Activity'],
    summary: 'Feed lintas aktivitas publik (beranda)',
    description:
      'Gabungan kata baru, komentar, vote, diskusi, kontribusi media, ' +
      'search-miss tayang, dan selamat datang akun terverifikasi. ' +
      'Tanpa auth. Cursor opaque (created_at + id); limit 1-50 (default 20).',
    request: { query: listActivityQuerySchema },
    responses: {
      200: {
        description: 'Daftar aktivitas terbaru',
        content: json(listActivityResponseSchema),
      },
      400: { description: 'Query tidak valid', content: json(errorResponseSchema) },
      429: { description: 'Rate limit', content: json(errorResponseSchema) },
    },
  });

  routes.openapi(listRoute, ((c: any) => {
    const q = c.req.valid('query') as z.infer<typeof listActivityQuerySchema>;
    return deps.controller.list(c, q);
  }) as never);

  return routes;
}
