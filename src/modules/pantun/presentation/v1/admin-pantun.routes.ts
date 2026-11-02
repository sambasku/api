import type { MiddlewareHandler } from 'hono';
import { createRoute } from '@hono/zod-openapi';
import { z } from 'zod';
import { authorizeRole } from '@/shared/middlewares/authorize-role.middleware';
import { rateLimit } from '@/shared/middlewares/rate-limit.middleware';
import { createOpenApiApp } from '@/shared/openapi/openapi-app';
import { errorResponseSchema } from '@/shared/openapi/error-response.schema';
import type { AppVariables } from '@/shared/types';
import type { PantunController } from './pantun.controller';
import {
  deletePantunResponseSchema,
  listAdminPantunsQuerySchema,
  pantunIdParamSchema,
  pantunReplyIdParamSchema,
  listPantunsResponseSchema,
  createPantunResponseSchema,
} from './validators/pantun.validator';

const json = <T extends z.ZodType>(schema: T) => ({
  'application/json': { schema },
});

export interface AdminPantunRoutesDeps {
  controller: PantunController;
  authenticate: MiddlewareHandler<{ Variables: AppVariables }>;
}

/** Moderasi pantun: admin, root, reviewer, editor. */
export function createAdminPantunRoutes(deps: AdminPantunRoutesDeps) {
  const routes = createOpenApiApp();
  const mod = [
    deps.authenticate,
    authorizeRole('admin', 'root', 'reviewer', 'editor'),
    rateLimit({ points: 500, duration: 60 }),
  ] as const;

  routes.use('/', ...mod);
  routes.use('/:id/takedown', ...mod);
  routes.use('/replies/:id/takedown', ...mod);

  const listRoute = createRoute({
    method: 'get',
    path: '/',
    tags: ['Pantun', 'Admin'],
    summary: 'Semua pantun (admin)',
    request: { query: listAdminPantunsQuerySchema },
    responses: {
      200: { description: 'Daftar semua status', content: json(listPantunsResponseSchema) },
      401: { description: 'Token tidak ada/invalid', content: json(errorResponseSchema) },
      403: { description: 'Bukan verifikator', content: json(errorResponseSchema) },
    },
  });

  const takedownRoute = createRoute({
    method: 'post',
    path: '/:id/takedown',
    tags: ['Pantun', 'Admin'],
    summary: 'Tarik pantun dari feed setelah tayang',
    request: { params: pantunIdParamSchema },
    responses: {
      200: { description: 'Di-takedown', content: json(createPantunResponseSchema) },
      401: { description: 'Token tidak ada/invalid', content: json(errorResponseSchema) },
      403: { description: 'Bukan verifikator', content: json(errorResponseSchema) },
      404: { description: 'Tidak ditemukan / sudah diturunkan', content: json(errorResponseSchema) },
    },
  });

  const takedownReplyRoute = createRoute({
    method: 'post',
    path: '/replies/:id/takedown',
    tags: ['Pantun', 'Admin'],
    summary: 'Takedown balasan pantun',
    request: { params: pantunReplyIdParamSchema },
    responses: {
      200: { description: 'Balasan di-takedown', content: json(deletePantunResponseSchema) },
      401: { description: 'Token tidak ada/invalid', content: json(errorResponseSchema) },
      403: { description: 'Bukan verifikator', content: json(errorResponseSchema) },
      404: { description: 'Balasan tidak ditemukan', content: json(errorResponseSchema) },
    },
  });

  routes.openapi(listRoute, (c) =>
    deps.controller.listAdmin(c, c.req.valid('query')) as never,
  );
  routes.openapi(takedownRoute, (c) =>
    deps.controller.takedown(c, c.req.valid('param').id) as never,
  );
  routes.openapi(takedownReplyRoute, (c) =>
    deps.controller.takedownReply(c, c.req.valid('param').id) as never,
  );
  return routes;
}
