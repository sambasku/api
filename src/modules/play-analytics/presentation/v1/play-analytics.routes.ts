import type { MiddlewareHandler } from 'hono';
import { createRoute } from '@hono/zod-openapi';
import type { z } from 'zod';
import { authorizeRole } from '@/shared/middlewares/authorize-role.middleware';
import { rateLimit } from '@/shared/middlewares/rate-limit.middleware';
import { createOpenApiApp } from '@/shared/openapi/openapi-app';
import { errorResponseSchema } from '@/shared/openapi/error-response.schema';
import type { AppVariables } from '@/shared/types';
import type { PlayAnalyticsController } from './play-analytics.controller';
import {
  playAnalyticsParamsSchema,
  playAnalyticsQuerySchema,
  playAnalyticsResponseSchema,
} from './validators/play-analytics.validator';

const json = <T extends z.ZodType>(schema: T) => ({
  'application/json': { schema },
});

export function createPlayAnalyticsRoutes(deps: {
  controller: PlayAnalyticsController;
  authenticate: MiddlewareHandler<{ Variables: AppVariables }>;
}) {
  const routes = createOpenApiApp();
  // Statistik Play Store - admin & root saja. Cache miss = unduh CSV dari GCS.
  routes.use('*', deps.authenticate, authorizeRole('admin', 'root'), rateLimit({ points: 60, duration: 60 }));

  const reportRoute = createRoute({
    method: 'get',
    path: '/{section}',
    tags: ['Play Analytics'],
    summary: 'Statistik Play Store per bagian (instal & rating dari export GCS), sudah dinormalisasi',
    description:
      'Status provider: ok | empty | not_configured | error. Kegagalan Google Cloud Storage dikembalikan ' +
      'sebagai status error di dalam 200, bukan 5xx endpoint.',
    request: { params: playAnalyticsParamsSchema, query: playAnalyticsQuerySchema },
    responses: {
      200: { description: 'Laporan statistik Play', content: json(playAnalyticsResponseSchema) },
      400: { description: 'Rentang tanggal tidak valid', content: json(errorResponseSchema) },
      401: { description: 'Token tidak ada/invalid', content: json(errorResponseSchema) },
      403: { description: 'Role tidak diizinkan (admin/root)', content: json(errorResponseSchema) },
    },
  });

  routes.openapi(
    reportRoute,
    (c) => deps.controller.report(c, c.req.valid('param').section, c.req.valid('query')) as never,
  );
  return routes;
}
