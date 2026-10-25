import type { MiddlewareHandler } from 'hono';
import { createRoute, z } from '@hono/zod-openapi';
import { authorizeRole } from '@/shared/middlewares/authorize-role.middleware';
import { rateLimit } from '@/shared/middlewares/rate-limit.middleware';
import { createOpenApiApp } from '@/shared/openapi/openapi-app';
import { errorResponseSchema } from '@/shared/openapi/error-response.schema';
import type { AppVariables } from '@/shared/types';
import type { MobileReleaseController } from './mobile-release.controller';
import {
  platformSchema,
  getLatestQuerySchema,
  getLatestResponseSchema,
  listResponseSchema,
  upsertBodySchema,
  upsertResponseSchema,
} from './validators/mobile-release.validator';

const json = <T extends import('zod').ZodType>(schema: T) => ({
  'application/json': { schema },
});

export interface MobileReleasePublicRoutesDeps {
  controller: MobileReleaseController;
}

export interface MobileReleaseAdminRoutesDeps {
  controller: MobileReleaseController;
  authenticate: MiddlewareHandler<{ Variables: AppVariables }>;
}

/** Public route: GET /api/v1/mobile-release/latest?platform=android */
export function createMobileReleasePublicRoutes(deps: MobileReleasePublicRoutesDeps) {
  const routes = createOpenApiApp();

  routes.use('*', rateLimit({ points: 30, duration: 60 }));

  routes.openapi(
    createRoute({
      method: 'get',
      path: '/latest',
      tags: ['Mobile Release'],
      summary: 'Cek versi terbaru untuk platform (Android/iOS)',
      description: 'Mobile memanggil saat start, bandingkan dengan PackageInfo, tampil banner update jika versi API lebih tinggi.',
      request: { query: getLatestQuerySchema },
      responses: {
        200: {
          description: 'Versi terbaru untuk platform',
          content: json(getLatestResponseSchema),
        },
        400: { description: 'Platform tidak valid', content: json(errorResponseSchema) },
      },
    }),
    (c) => deps.controller.getLatest(c, c.req.valid('query')) as never,
  );

  return routes;
}

/** Admin routes: /api/v1/admin/mobile-release */
export function createMobileReleaseAdminRoutes(deps: MobileReleaseAdminRoutesDeps) {
  const routes = createOpenApiApp();

  routes.use(
    '*',
    deps.authenticate,
    authorizeRole('admin', 'root'),
  );

  routes.openapi(
    createRoute({
      method: 'get',
      path: '/',
      tags: ['Admin Mobile Release'],
      summary: 'Daftar release per platform',
      responses: {
        200: { description: 'Daftar release', content: json(listResponseSchema) },
        401: { description: 'Tidak terautentikasi', content: json(errorResponseSchema) },
        403: { description: 'Bukan admin/root', content: json(errorResponseSchema) },
      },
    }),
    (c) => deps.controller.list(c) as never,
  );

  routes.openapi(
    createRoute({
      method: 'put',
      path: '/{platform}',
      tags: ['Admin Mobile Release'],
      summary: 'Upsert versi terbaru untuk platform',
      request: {
        params: z.object({ platform: platformSchema }),
        body: { content: json(upsertBodySchema) },
      },
      responses: {
        200: { description: 'Release diupdate', content: json(upsertResponseSchema) },
        400: { description: 'Platform/version tidak valid', content: json(errorResponseSchema) },
        401: { description: 'Tidak terautentikasi', content: json(errorResponseSchema) },
        403: { description: 'Bukan admin/root', content: json(errorResponseSchema) },
      },
    }),
    (c) =>
      deps.controller.upsert(c, c.req.valid('param').platform, c.req.valid('json')) as never,
  );

  return routes;
}
