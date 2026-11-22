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
  addLeaderboardExclusionBodySchema,
  finalizeLeaderboardBodySchema,
  getLeaderboardQuerySchema,
  getPointsHistoryResponseSchema,
  leaderboardAdminActionResponseSchema,
  leaderboardExclusionListResponseSchema,
  leaderboardExclusionMutationResponseSchema,
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

  const pointsHistoryRoute = createRoute({
    method: 'get',
    path: '/users/{username}/points-history',
    tags: ['Leaderboard'],
    summary: 'Riwayat poin mingguan user (snapshot per minggu)',
    request: {
      params: z.object({ username: z.string().min(1).max(100) }),
      query: z.object({ limit: z.coerce.number().int().min(1).max(52).default(52) }),
    },
    responses: {
      200: { description: 'Riwayat poin', content: json(getPointsHistoryResponseSchema) },
      404: { description: 'User tidak ditemukan', content: json(errorResponseSchema) },
    },
  });
  routes.openapi(
    pointsHistoryRoute,
    (c) =>
      deps.controller.pointsHistory(
        c,
        c.req.param('username'),
        c.req.valid('query').limit,
      ) as never,
  );
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

  const listExclusionsRoute = createRoute({
    method: 'get',
    path: '/exclusions',
    tags: ['Admin Leaderboard'],
    summary: 'Daftar user yang dikecualikan dari papan peringkat',
    responses: {
      200: { description: 'Daftar exclude', content: json(leaderboardExclusionListResponseSchema) },
    },
  });

  const addExclusionRoute = createRoute({
    method: 'post',
    path: '/exclusions',
    tags: ['Admin Leaderboard'],
    summary: 'Tambah user ke daftar exclude papan peringkat',
    request: { body: { content: json(addLeaderboardExclusionBodySchema) } },
    responses: {
      200: { description: 'Exclude ditambah', content: json(leaderboardExclusionMutationResponseSchema) },
      404: { description: 'User tidak ditemukan', content: json(errorResponseSchema) },
    },
  });

  const removeExclusionRoute = createRoute({
    method: 'delete',
    path: '/exclusions/{userId}',
    tags: ['Admin Leaderboard'],
    summary: 'Hapus user dari daftar exclude (kecuali akun sistem bawaan)',
    request: {
      params: z.object({
        userId: z.string().min(1).max(26),
      }),
    },
    responses: {
      200: { description: 'Exclude dihapus', content: json(leaderboardExclusionMutationResponseSchema) },
      403: { description: 'Akun sistem dilindungi', content: json(errorResponseSchema) },
      404: { description: 'Tidak di daftar', content: json(errorResponseSchema) },
    },
  });

  const listSystemExclusionsRoute = createRoute({
    method: 'get',
    path: '/exclusions/system',
    tags: ['Admin Leaderboard'],
    summary: 'Semua user sistem bawaan + status exclude (untuk toggle panel)',
    responses: {
      200: { description: 'Daftar user sistem', content: json(leaderboardExclusionListResponseSchema) },
    },
  });

  routes.openapi(listSystemExclusionsRoute, (c) => deps.controller.listSystemUsers(c) as never);
  routes.openapi(listExclusionsRoute, (c) => deps.controller.listExclusions(c) as never);
  routes.openapi(addExclusionRoute, (c) =>
    deps.controller.addExclusion(c, c.req.valid('json')) as never,
  );
  routes.openapi(removeExclusionRoute, (c) =>
    deps.controller.removeExclusion(c, c.req.valid('param').userId) as never,
  );
  return routes;
}