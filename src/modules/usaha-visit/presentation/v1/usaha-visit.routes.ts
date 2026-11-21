import type { MiddlewareHandler } from 'hono';
import { createRoute } from '@hono/zod-openapi';
import { z } from 'zod';
import { authorizeRole } from '@/shared/middlewares/authorize-role.middleware';
import { rateLimit } from '@/shared/middlewares/rate-limit.middleware';
import { createOpenApiApp } from '@/shared/openapi/openapi-app';
import { errorResponseSchema } from '@/shared/openapi/error-response.schema';
import type { AppVariables, AuthUser } from '@/shared/types';
import type { UsahaVisitController } from './usaha-visit.controller';
import {
  listUsahaVisitsQuerySchema,
  listUsahaVisitsResponseSchema,
  usahaVisitParamsSchema,
  usahaVisitStateSchema,
} from './validators/usaha-visit.validator';

const json = <T extends z.ZodType>(schema: T) => ({
  'application/json': { schema },
});

/** POST/DELETE /api/v1/usaha/:id/visits - login. */
export function createUsahaVisitRoutes(deps: {
  controller: UsahaVisitController;
  authenticate: MiddlewareHandler<{ Variables: AppVariables }>;
  requireApprovedClient?: MiddlewareHandler<{ Variables: AppVariables }>;
}) {
  const routes = createOpenApiApp();

  routes.use(
    '/:id/visits',
    deps.authenticate,
    ...(deps.requireApprovedClient ? [deps.requireApprovedClient] : []),
    rateLimit({
      points: 30,
      duration: 60,
      keyFn: (c) => {
        const user = (c.get('user') as AuthUser | undefined) ?? null;
        return `usaha-visit:${user?.user_id ?? 'unknown'}`;
      },
    }),
  );

  const markRoute = createRoute({
    method: 'post',
    path: '/:id/visits',
    tags: ['Usaha Visits'],
    summary: 'Tandai pernah bertransaksi di usaha (login)',
    request: { params: usahaVisitParamsSchema },
    responses: {
      200: { description: 'State kunjungan', content: json(usahaVisitStateSchema) },
      401: { description: 'Tidak terautentikasi', content: json(errorResponseSchema) },
      404: { description: 'Usaha tidak ditemukan', content: json(errorResponseSchema) },
      429: { description: 'Terlalu banyak (30/menit)', content: json(errorResponseSchema) },
    },
  });

  const unmarkRoute = createRoute({
    method: 'delete',
    path: '/:id/visits',
    tags: ['Usaha Visits'],
    summary: 'Batal tandai bertransaksi (login)',
    request: { params: usahaVisitParamsSchema },
    responses: {
      200: { description: 'State kunjungan', content: json(usahaVisitStateSchema) },
      401: { description: 'Tidak terautentikasi', content: json(errorResponseSchema) },
      404: { description: 'Usaha tidak ditemukan', content: json(errorResponseSchema) },
      429: { description: 'Terlalu banyak (30/menit)', content: json(errorResponseSchema) },
    },
  });

  routes.openapi(
    markRoute,
    (c) => deps.controller.mark(c, c.req.valid('param')) as never,
  );
  routes.openapi(
    unmarkRoute,
    (c) => deps.controller.unmark(c, c.req.valid('param')) as never,
  );

  return routes;
}

/** GET /api/v1/admin/usaha/:id/visits - root/admin/reviewer. */
export function createAdminUsahaVisitRoutes(deps: {
  controller: UsahaVisitController;
  authenticate: MiddlewareHandler<{ Variables: AppVariables }>;
}) {
  const routes = createOpenApiApp();
  routes.use('*', rateLimit({ points: 60, duration: 60 }));
  routes.use(
    '/:id/visits',
    deps.authenticate,
    authorizeRole('root', 'admin', 'reviewer'),
  );

  const listRoute = createRoute({
    method: 'get',
    path: '/:id/visits',
    tags: ['Admin Usaha Visits'],
    summary: 'Daftar pengunjung yang menandai bertransaksi (admin)',
    request: {
      params: usahaVisitParamsSchema,
      query: listUsahaVisitsQuerySchema,
    },
    responses: {
      200: {
        description: 'Daftar kunjungan',
        content: json(listUsahaVisitsResponseSchema),
      },
      404: { description: 'Usaha tidak ditemukan', content: json(errorResponseSchema) },
    },
  });

  routes.openapi(
    listRoute,
    (c) =>
      deps.controller.listAdmin(
        c,
        c.req.valid('param'),
        c.req.valid('query'),
      ) as never,
  );

  return routes;
}