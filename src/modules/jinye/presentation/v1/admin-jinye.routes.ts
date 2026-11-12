import type { MiddlewareHandler } from 'hono';
import { createRoute } from '@hono/zod-openapi';
import { z } from 'zod';
import { authorizeRole } from '@/shared/middlewares/authorize-role.middleware';
import { rateLimit } from '@/shared/middlewares/rate-limit.middleware';
import { createOpenApiApp } from '@/shared/openapi/openapi-app';
import { errorResponseSchema } from '@/shared/openapi/error-response.schema';
import type { AppVariables } from '@/shared/types';
import type { JinyeController } from './jinye.controller';
import {
  adminJinyeCommentTakedownParamSchema,
  adminJinyeItemResponseSchema,
  adminJinyeOkResponseSchema,
  jinyeIdParamSchema,
  listAdminJinyeQuerySchema,
  listAdminJinyeResponseSchema,
} from './validators/jinye.validator';

const json = <T extends z.ZodType>(schema: T) => ({
  'application/json': { schema },
});

export interface AdminJinyeRoutesDeps {
  controller: JinyeController;
  authenticate: MiddlewareHandler<{ Variables: AppVariables }>;
}

/** Moderasi Jinye: admin, root, reviewer, editor. */
export function createAdminJinyeRoutes(deps: AdminJinyeRoutesDeps) {
  const routes = createOpenApiApp();
  const mod = [
    deps.authenticate,
    authorizeRole('admin', 'root', 'reviewer', 'editor'),
    rateLimit({ points: 500, duration: 60 }),
  ] as const;

  routes.use('/', ...mod);
  routes.use('/:id/takedown', ...mod);
  routes.use('/comments/:id/takedown', ...mod);

  const listRoute = createRoute({
    method: 'get',
    path: '/',
    tags: ['Jinye', 'Admin'],
    summary: 'Semua Jinye (admin) - filter status/username',
    request: { query: listAdminJinyeQuerySchema },
    responses: {
      200: {
        description: 'Daftar semua status',
        content: json(listAdminJinyeResponseSchema),
      },
      401: { description: 'Token tidak ada/invalid', content: json(errorResponseSchema) },
      403: { description: 'Role tidak diizinkan', content: json(errorResponseSchema) },
      404: { description: 'Username tidak ditemukan', content: json(errorResponseSchema) },
    },
  });

  const takedownRoute = createRoute({
    method: 'post',
    path: '/:id/takedown',
    tags: ['Jinye', 'Admin'],
    summary: 'Tarik Jinye dari feed setelah tayang',
    request: { params: jinyeIdParamSchema },
    responses: {
      200: { description: 'Di-takedown', content: json(adminJinyeItemResponseSchema) },
      401: { description: 'Token tidak ada/invalid', content: json(errorResponseSchema) },
      403: { description: 'Role tidak diizinkan', content: json(errorResponseSchema) },
      404: { description: 'Tidak ditemukan / sudah diturunkan', content: json(errorResponseSchema) },
    },
  });

  const takedownCommentRoute = createRoute({
    method: 'post',
    path: '/comments/:id/takedown',
    tags: ['Jinye', 'Admin'],
    summary: 'Takedown komentar Jinye',
    request: { params: adminJinyeCommentTakedownParamSchema },
    responses: {
      200: { description: 'Komentar di-takedown', content: json(adminJinyeOkResponseSchema) },
      401: { description: 'Token tidak ada/invalid', content: json(errorResponseSchema) },
      403: { description: 'Role tidak diizinkan', content: json(errorResponseSchema) },
      404: { description: 'Komentar tidak ditemukan', content: json(errorResponseSchema) },
    },
  });

  routes.openapi(listRoute, (c) =>
    deps.controller.listAdmin(c, c.req.valid('query')) as never,
  );
  routes.openapi(takedownRoute, (c) =>
    deps.controller.takedown(c, c.req.valid('param').id) as never,
  );
  routes.openapi(takedownCommentRoute, (c) =>
    deps.controller.takedownComment(c, c.req.valid('param').id) as never,
  );
  return routes;
}
