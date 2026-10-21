import type { MiddlewareHandler } from 'hono';
import { createRoute } from '@hono/zod-openapi';
import { z } from 'zod';
import { authorizeRole } from '@/shared/middlewares/authorize-role.middleware';
import { rateLimit } from '@/shared/middlewares/rate-limit.middleware';
import { createOpenApiApp } from '@/shared/openapi/openapi-app';
import { errorResponseSchema } from '@/shared/openapi/error-response.schema';
import type { AppVariables } from '@/shared/types';
import type { AchievementController } from './achievement.controller';
import {
  achievementAdminListResponseSchema,
  achievementBorderResponseSchema,
  achievementGrantResponseSchema,
  achievementItemResponseSchema,
  achievementListResponseSchema,
  achievementPreviewResponseSchema,
  achievementRecipientsResponseSchema,
  achievementScanResponseSchema,
  createAchievementBodySchema,
  grantAchievementBodySchema,
  listAchievementsQuerySchema,
  scanAchievementBodySchema,
  setBorderBodySchema,
  updateAchievementBodySchema,
} from './validators/achievement.validator';

const json = <T extends z.ZodType>(schema: T) => ({
  'application/json': { schema },
});

export interface AchievementRoutesDeps {
  controller: AchievementController;
  authenticate: MiddlewareHandler<{ Variables: AppVariables }>;
}

const idParam = z.object({ id: z.string().length(26) });

/**
 * Admin achievement: CRUD katalog + evaluasi (scan/grant/preview/revoke).
 * Gate root|admin - semua mutasi menulis audit_logs di use case.
 */
export function createAdminAchievementRoutes(deps: AchievementRoutesDeps) {
  const routes = createOpenApiApp();
  routes.use('*', rateLimit({ points: 60, duration: 60 }));
  routes.use('*', deps.authenticate, authorizeRole('root', 'admin'));

  const listRoute = createRoute({
    method: 'get',
    path: '/',
    tags: ['Admin Achievements'],
    summary: 'List katalog achievement (admin, semua status)',
    request: { query: listAchievementsQuerySchema },
    responses: {
      200: { description: 'Daftar achievement', content: json(achievementAdminListResponseSchema) },
    },
  });
  const createRouteDef = createRoute({
    method: 'post',
    path: '/',
    tags: ['Admin Achievements'],
    summary: 'Buat achievement baru',
    request: { body: { content: json(createAchievementBodySchema) } },
    responses: {
      200: { description: 'Achievement dibuat', content: json(achievementItemResponseSchema) },
      400: { description: 'Data tidak valid', content: json(errorResponseSchema) },
      409: { description: 'Kode sudah dipakai', content: json(errorResponseSchema) },
    },
  });
  const updateRoute = createRoute({
    method: 'put',
    path: '/:id',
    tags: ['Admin Achievements'],
    summary: 'Update achievement (code immutable)',
    request: {
      params: idParam,
      body: { content: json(updateAchievementBodySchema) },
    },
    responses: {
      200: { description: 'Achievement diperbarui', content: json(achievementItemResponseSchema) },
      404: { description: 'Tidak ditemukan', content: json(errorResponseSchema) },
    },
  });
  const deleteRoute = createRoute({
    method: 'delete',
    path: '/:id',
    tags: ['Admin Achievements'],
    summary: 'Soft delete achievement',
    request: { params: idParam },
    responses: {
      200: { description: 'Terhapus', content: json(z.object({ success: z.literal(true), data: z.null() })) },
      404: { description: 'Tidak ditemukan', content: json(errorResponseSchema) },
    },
  });
  const scanRoute = createRoute({
    method: 'post',
    path: '/:id/scan',
    tags: ['Admin Achievements'],
    summary: 'Backfill scan satu achievement (idempotent)',
    request: { params: idParam, body: { content: json(scanAchievementBodySchema) } },
    responses: {
      200: { description: 'Hasil scan', content: json(achievementScanResponseSchema) },
      404: { description: 'Tidak ditemukan', content: json(errorResponseSchema) },
    },
  });
  const grantRoute = createRoute({
    method: 'post',
    path: '/:id/grant',
    tags: ['Admin Achievements'],
    summary: 'Grant manual ke usernames',
    request: { params: idParam, body: { content: json(grantAchievementBodySchema) } },
    responses: {
      200: { description: 'Hasil grant', content: json(achievementGrantResponseSchema) },
      404: { description: 'Tidak ditemukan', content: json(errorResponseSchema) },
    },
  });
  const previewRoute = createRoute({
    method: 'get',
    path: '/:id/preview',
    tags: ['Admin Achievements'],
    summary: 'Preview pemenuh kriteria (jumlah + sampel)',
    request: { params: idParam },
    responses: {
      200: { description: 'Preview', content: json(achievementPreviewResponseSchema) },
      404: { description: 'Tidak ditemukan', content: json(errorResponseSchema) },
    },
  });
  const revokeRoute = createRoute({
    method: 'delete',
    path: '/:id/awards/:awardId',
    tags: ['Admin Achievements'],
    summary: 'Revoke satu award user (soft delete)',
    request: { params: z.object({ id: z.string().length(26), awardId: z.string().length(26) }) },
    responses: {
      200: { description: 'Award dicabut', content: json(z.object({ success: z.literal(true), data: z.null() })) },
      404: { description: 'Tidak ditemukan', content: json(errorResponseSchema) },
    },
  });
  const recipientsRoute = createRoute({
    method: 'get',
    path: '/:id/recipients',
    tags: ['Admin Achievements'],
    summary: 'Daftar penerima (award id untuk revoke)',
    request: {
      params: idParam,
      query: z.object({
        limit: z.coerce.number().int().min(1).max(100).default(20),
        before: z.string().length(26).optional(),
      }),
    },
    responses: {
      200: { description: 'Penerima', content: json(achievementRecipientsResponseSchema) },
      404: { description: 'Tidak ditemukan', content: json(errorResponseSchema) },
    },
  });

  routes.openapi(listRoute, (c) => deps.controller.listAdmin(c, c.req.valid('query')) as never);
  routes.openapi(createRouteDef, (c) => deps.controller.create(c, c.req.valid('json')) as never);
  routes.openapi(updateRoute, (c) =>
    deps.controller.update(c, c.req.param('id'), c.req.valid('json')) as never,
  );
  routes.openapi(deleteRoute, (c) => deps.controller.remove(c, c.req.param('id')) as never);
  routes.openapi(scanRoute, (c) =>
    deps.controller.scan(c, c.req.param('id'), c.req.valid('json')) as never,
  );
  routes.openapi(grantRoute, (c) =>
    deps.controller.grant(c, c.req.param('id'), c.req.valid('json')) as never,
  );
  routes.openapi(previewRoute, (c) => deps.controller.preview(c, c.req.param('id')) as never);
  routes.openapi(revokeRoute, (c) =>
    deps.controller.revoke(c, c.req.param('awardId')) as never,
  );
  routes.openapi(recipientsRoute, (c) =>
    deps.controller.listRecipients(c, c.req.param('id'), c.req.valid('query')) as never,
  );
  return routes;
}

/** Publik: katalog aktif (tanpa auth) + badge profil per username. */
export function createPublicAchievementRoutes(deps: { controller: AchievementController }) {
  const routes = createOpenApiApp();
  routes.use('*', rateLimit({ points: 60, duration: 60 }));

  const listRoute = createRoute({
    method: 'get',
    path: '/',
    tags: ['Achievements'],
    summary: 'Katalog achievement aktif',
    request: { query: listAchievementsQuerySchema },
    responses: {
      200: { description: 'Katalog', content: json(achievementListResponseSchema) },
    },
  });
  const byUsernameRoute = createRoute({
    method: 'get',
    path: '/users/:username',
    tags: ['Achievements'],
    summary: 'Reward milik user publik (badge profil)',
    request: { params: z.object({ username: z.string().min(2).max(40) }) },
    responses: {
      200: { description: 'Reward milik user', content: json(achievementListResponseSchema) },
    },
  });

  routes.openapi(listRoute, (c) => deps.controller.listPublic(c, c.req.valid('query')) as never);
  routes.openapi(byUsernameRoute, (c) =>
    deps.controller.listByUsername(c, c.req.param('username')) as never,
  );
  return routes;
}

/** Auth user: katalog milik sendiri (owned + locked). */
export function createMyAchievementRoutes(deps: AchievementRoutesDeps) {
  const routes = createOpenApiApp();
  routes.use('*', rateLimit({ points: 60, duration: 60 }));
  routes.use('*', deps.authenticate);

  const listRoute = createRoute({
    method: 'get',
    path: '/',
    tags: ['Achievements'],
    summary: 'Achievement milikku (owned + locked)',
    request: { query: listAchievementsQuerySchema },
    responses: {
      200: { description: 'Milikku', content: json(achievementListResponseSchema) },
    },
  });

  routes.openapi(listRoute, (c) => deps.controller.listMine(c, c.req.valid('query')) as never);
  return routes;
}

/** Auth user: bingkai profil aktif (`PATCH /api/v1/me/profile/border`). */
export function createMyProfileBorderRoutes(deps: AchievementRoutesDeps) {
  const routes = createOpenApiApp();
  routes.use('*', rateLimit({ points: 60, duration: 60 }));
  routes.use('*', deps.authenticate);

  const setBorderRoute = createRoute({
    method: 'patch',
    path: '/border',
    tags: ['Achievements'],
    summary: 'Set / lepas bingkai profil aktif',
    request: { body: { content: json(setBorderBodySchema) } },
    responses: {
      200: { description: 'Border diperbarui', content: json(achievementBorderResponseSchema) },
      403: { description: 'Border bukan milik user', content: json(errorResponseSchema) },
    },
  });

  routes.openapi(setBorderRoute, (c) => deps.controller.setBorder(c, c.req.valid('json')) as never);
  return routes;
}
