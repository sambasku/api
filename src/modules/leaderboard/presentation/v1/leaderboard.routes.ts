import type { MiddlewareHandler } from 'hono';
import { createRoute } from '@hono/zod-openapi';
import { z } from 'zod';
import { authorizeRole } from '@/shared/middlewares/authorize-role.middleware';
import { rateLimit } from '@/shared/middlewares/rate-limit.middleware';
import { createOpenApiApp } from '@/shared/openapi/openapi-app';
import { errorResponseSchema } from '@/shared/openapi/error-response.schema';
import type { AppVariables } from '@/shared/types';
import type { LeaderboardController } from './leaderboard.controller';
import {
  finalizeLeaderboardBodySchema,
  getLeaderboardQuerySchema,
  leaderboardAdminActionResponseSchema,
  leaderboardListResponseSchema,
} from './validators/leaderboard.validator';

const json = <T extends z.ZodType>(schema: T) => ({
  'application/json': { schema },
});

export interface LeaderboardRoutesDeps {
  controller: LeaderboardController;
  authenticate: MiddlewareHandler<{ Variables: AppVariables }>;
}

export function createPublicLeaderboardRoutes(deps: { controller: LeaderboardController }) {
  const routes = createOpenApiApp();
  routes.use('*', rateLimit({ points: 100, duration: 60 }));

  const listRoute = createRoute({
    method: 'get',
    path: '/',
    tags: ['Leaderboard'],
    summary: 'Papan peringkat kontribusi dan verifikasi',
    request: { query: getLeaderboardQuerySchema },
    responses: {
      200: { description: 'Daftar peringkat', content: json(leaderboardListResponseSchema) },
      404: { description: 'Minggu tidak ditemukan', content: json(errorResponseSchema) },
    },
  });

  routes.openapi(listRoute, (c) => deps.controller.getPublic(c, c.req.valid('query')) as never);
  return routes;
}

export function createAdminLeaderboardRoutes(deps: LeaderboardRoutesDeps) {
  const routes = createOpenApiApp();
  routes.use('*', rateLimit({ points: 60, duration: 60 }));
  routes.use('*', deps.authenticate, authorizeRole('root', 'admin'));

  const refreshRoute = createRoute({
    method: 'post',
    path: '/refresh',
    tags: ['Admin Leaderboard'],
    summary: 'Paksa publikasi ulang current.json',
    responses: {
      200: { description: 'Refresh dijalankan', content: json(leaderboardAdminActionResponseSchema) },
      503: { description: 'Storage tidak tersedia', content: json(errorResponseSchema) },
    },
  });

  const finalizeRoute = createRoute({
    method: 'post',
    path: '/finalize',
    tags: ['Admin Leaderboard'],
    summary: 'Finalisasi minggu leaderboard (snapshot + CDN)',
    request: { body: { content: json(finalizeLeaderboardBodySchema) } },
    responses: {
      200: { description: 'Finalize dijalankan', content: json(leaderboardAdminActionResponseSchema) },
      404: { description: 'Minggu tidak ditemukan', content: json(errorResponseSchema) },
      503: { description: 'Storage tidak tersedia', content: json(errorResponseSchema) },
    },
  });

  routes.openapi(refreshRoute, (c) => deps.controller.adminRefresh(c) as never);
  routes.openapi(
    finalizeRoute,
    (c) => deps.controller.adminFinalize(c, c.req.valid('json')) as never,
  );
  return routes;
}