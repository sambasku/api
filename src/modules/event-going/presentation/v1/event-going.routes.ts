import type { MiddlewareHandler } from 'hono';
import { createRoute } from '@hono/zod-openapi';
import { z } from 'zod';
import { authorizeRole } from '@/shared/middlewares/authorize-role.middleware';
import { rateLimit } from '@/shared/middlewares/rate-limit.middleware';
import { createOpenApiApp } from '@/shared/openapi/openapi-app';
import { errorResponseSchema } from '@/shared/openapi/error-response.schema';
import type { AppVariables, AuthUser } from '@/shared/types';
import type { EventGoingController } from './event-going.controller';
import {
  eventGoingParamsSchema,
  eventGoingStateSchema,
  listEventGoingsQuerySchema,
  listEventGoingsResponseSchema,
} from './validators/event-going.validator';

const json = <T extends z.ZodType>(schema: T) => ({
  'application/json': { schema },
});

/** POST/DELETE /api/v1/events/:id/going - login. */
export function createEventGoingRoutes(deps: {
  controller: EventGoingController;
  authenticate: MiddlewareHandler<{ Variables: AppVariables }>;
  requireApprovedClient?: MiddlewareHandler<{ Variables: AppVariables }>;
}) {
  const routes = createOpenApiApp();

  routes.use(
    '/:id/going',
    deps.authenticate,
    ...(deps.requireApprovedClient ? [deps.requireApprovedClient] : []),
    rateLimit({
      points: 30,
      duration: 60,
      keyFn: (c) => {
        const user = (c.get('user') as AuthUser | undefined) ?? null;
        return `event-going:${user?.user_id ?? 'unknown'}`;
      },
    }),
  );

  const markRoute = createRoute({
    method: 'post',
    path: '/:id/going',
    tags: ['Event Going'],
    summary: 'Tandai berencana datang ke acara (login)',
    request: { params: eventGoingParamsSchema },
    responses: {
      200: { description: 'State going', content: json(eventGoingStateSchema) },
      400: { description: 'Acara dibatalkan/selesai', content: json(errorResponseSchema) },
      401: { description: 'Tidak terautentikasi', content: json(errorResponseSchema) },
      404: { description: 'Acara tidak ditemukan', content: json(errorResponseSchema) },
      429: { description: 'Terlalu banyak (30/menit)', content: json(errorResponseSchema) },
    },
  });

  const unmarkRoute = createRoute({
    method: 'delete',
    path: '/:id/going',
    tags: ['Event Going'],
    summary: 'Batal rencana datang (login)',
    request: { params: eventGoingParamsSchema },
    responses: {
      200: { description: 'State going', content: json(eventGoingStateSchema) },
      400: { description: 'Acara dibatalkan/selesai', content: json(errorResponseSchema) },
      401: { description: 'Tidak terautentikasi', content: json(errorResponseSchema) },
      404: { description: 'Acara tidak ditemukan', content: json(errorResponseSchema) },
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

/** GET /api/v1/admin/events/:id/goings - root/admin/reviewer. */
export function createAdminEventGoingRoutes(deps: {
  controller: EventGoingController;
  authenticate: MiddlewareHandler<{ Variables: AppVariables }>;
}) {
  const routes = createOpenApiApp();
  routes.use('*', rateLimit({ points: 60, duration: 60 }));
  routes.use(
    '/:id/goings',
    deps.authenticate,
    authorizeRole('root', 'admin', 'reviewer'),
  );

  const listRoute = createRoute({
    method: 'get',
    path: '/:id/goings',
    tags: ['Admin Event Going'],
    summary: 'Daftar orang yang berencana datang (admin)',
    request: {
      params: eventGoingParamsSchema,
      query: listEventGoingsQuerySchema,
    },
    responses: {
      200: {
        description: 'Daftar goings',
        content: json(listEventGoingsResponseSchema),
      },
      404: { description: 'Acara tidak ditemukan', content: json(errorResponseSchema) },
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
