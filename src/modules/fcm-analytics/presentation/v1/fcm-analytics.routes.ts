import type { MiddlewareHandler } from 'hono';
import { createRoute } from '@hono/zod-openapi';
import type { z } from 'zod';
import { authorizeRole } from '@/shared/middlewares/authorize-role.middleware';
import { rateLimit } from '@/shared/middlewares/rate-limit.middleware';
import { createOpenApiApp } from '@/shared/openapi/openapi-app';
import { errorResponseSchema } from '@/shared/openapi/error-response.schema';
import type { AppVariables } from '@/shared/types';
import type { FcmAnalyticsController } from './fcm-analytics.controller';
import {
  fcmAnalyticsParamsSchema,
  fcmAnalyticsQuerySchema,
  fcmAnalyticsResponseSchema,
} from './validators/fcm-analytics.validator';

const json = <T extends z.ZodType>(schema: T) => ({
  'application/json': { schema },
});

export function createFcmAnalyticsRoutes(deps: {
  controller: FcmAnalyticsController;
  authenticate: MiddlewareHandler<{ Variables: AppVariables }>;
}) {
  const routes = createOpenApiApp();
  // Analitik notifikasi - admin & root saja. Cache miss = call ke Google API.
  routes.use('*', deps.authenticate, authorizeRole('admin', 'root'), rateLimit({ points: 60, duration: 60 }));

  const reportRoute = createRoute({
    method: 'get',
    path: '/{section}',
    tags: ['FCM Analytics'],
    summary: 'Analitik notifikasi push per bagian (delivery FCM + open rate GA4), sudah dinormalisasi',
    description:
      'Status provider: ok | empty | not_configured | error. Kegagalan Google (Firebase/GA4) dikembalikan ' +
      'sebagai status error di dalam 200, bukan 5xx endpoint. Data delivery FCM tersimpan ~14 hari terakhir.',
    request: { params: fcmAnalyticsParamsSchema, query: fcmAnalyticsQuerySchema },
    responses: {
      200: { description: 'Laporan analitik notifikasi', content: json(fcmAnalyticsResponseSchema) },
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
