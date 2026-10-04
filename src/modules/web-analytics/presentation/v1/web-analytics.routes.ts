import type { MiddlewareHandler } from 'hono';
import { createRoute } from '@hono/zod-openapi';
import type { z } from 'zod';
import { authorizeRole } from '@/shared/middlewares/authorize-role.middleware';
import { rateLimit } from '@/shared/middlewares/rate-limit.middleware';
import { createOpenApiApp } from '@/shared/openapi/openapi-app';
import { errorResponseSchema } from '@/shared/openapi/error-response.schema';
import type { AppVariables } from '@/shared/types';
import type { WebAnalyticsController } from './web-analytics.controller';
import {
  webAnalyticsParamsSchema,
  webAnalyticsQuerySchema,
  webAnalyticsResponseSchema,
} from './validators/web-analytics.validator';

const json = <T extends z.ZodType>(schema: T) => ({
  'application/json': { schema },
});

export function createWebAnalyticsRoutes(deps: {
  controller: WebAnalyticsController;
  authenticate: MiddlewareHandler<{ Variables: AppVariables }>;
}) {
  const routes = createOpenApiApp();
  // Data trafik bisnis - admin & root saja. Rate limit lebih ketat dari
  // dashboard karena cache miss = request ke kuota Google.
  routes.use('*', deps.authenticate, authorizeRole('admin', 'root'), rateLimit({ points: 60, duration: 60 }));

  const reportRoute = createRoute({
    method: 'get',
    path: '/{section}',
    tags: ['Web Analytics'],
    summary: 'Trafik web per bagian (GA4 + Search Console), sudah dinormalisasi',
    description:
      'Status per provider: ok | empty | not_configured | error. Error Google (izin, kuota, 5xx, jaringan) ' +
      'dikembalikan sebagai status error di dalam 200, bukan 5xx endpoint.',
    request: { params: webAnalyticsParamsSchema, query: webAnalyticsQuerySchema },
    responses: {
      200: { description: 'Laporan trafik', content: json(webAnalyticsResponseSchema) },
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
