import { createRoute } from '@hono/zod-openapi';
import { z } from 'zod';
import { rateLimit } from '@/shared/middlewares/rate-limit.middleware';
import { createOpenApiApp } from '@/shared/openapi/openapi-app';
import { errorResponseSchema } from '@/shared/openapi/error-response.schema';
import type { HotTopicsController } from './hot-topics.controller';
import {
  hotTopicsQuerySchema,
  hotTopicsResponseSchema,
} from './validators/hot-topics.validator';

const json = <T extends z.ZodType>(schema: T) => ({
  'application/json': { schema },
});

export interface HotTopicsRoutesDeps {
  controller: HotTopicsController;
}

/** GET /api/v1/hot-topics - kartu Hot Home (G4). Publik, tanpa auth. */
export function createHotTopicsRoutes(deps: HotTopicsRoutesDeps) {
  const routes = createOpenApiApp();

  routes.use('*', rateLimit({ points: 100, duration: 60 }));

  const listRoute = createRoute({
    method: 'get',
    path: '/',
    tags: ['Hot Topics'],
    summary: 'Kartu Hot Home: Hits / Usulan / Dicari / Cek (24 jam + backfill 7 hari)',
    request: { query: hotTopicsQuerySchema },
    responses: {
      200: {
        description: 'Empat tab Hot (maks 10 item/tab)',
        content: json(hotTopicsResponseSchema),
      },
      400: { description: 'Query tidak valid', content: json(errorResponseSchema) },
    },
  });

  routes.openapi(listRoute, (c) =>
    deps.controller.list(c, c.req.valid('query')) as never,
  );

  return routes;
}
