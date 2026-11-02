import type { MiddlewareHandler } from 'hono';
import { createRoute } from '@hono/zod-openapi';
import { z } from 'zod';
import { authorizeRole } from '@/shared/middlewares/authorize-role.middleware';
import { rateLimit } from '@/shared/middlewares/rate-limit.middleware';
import { createOpenApiApp } from '@/shared/openapi/openapi-app';
import {
  errorResponseSchema,
  okNullResponseSchema,
} from '@/shared/openapi/error-response.schema';
import type { AppVariables } from '@/shared/types';
import type { UsahaClaimController } from './usaha-claim.controller';
import {
  adminUsahaClaimSchema,
  claimIdParamSchema,
  claimSlugParamSchema,
  listClaimsQuerySchema,
  publicUsahaClaimSchema,
  rejectClaimBodySchema,
  submitClaimBodySchema,
} from './validators/usaha-claim.validator';

const json = <T extends z.ZodType>(schema: T) => ({
  'application/json': { schema },
});

const okPublic = z.object({ success: z.literal(true), data: publicUsahaClaimSchema });
const okPublicList = z.object({
  success: z.literal(true),
  data: z.object({ items: z.array(publicUsahaClaimSchema) }),
});
const okAdminList = z.object({
  success: z.literal(true),
  data: z.object({ items: z.array(adminUsahaClaimSchema) }),
});

/**
 * Route klaim di-mount relatif terhadap `/usaha`:
 * POST /:slug/claims, GET /claims/mine, DELETE /claims/:id
 */
export function createUsahaClaimRoutes(deps: {
  controller: UsahaClaimController;
  authenticate: MiddlewareHandler<{ Variables: AppVariables }>;
}) {
  const routes = createOpenApiApp();
  // Scope ke path klaim saja: sub-app di-mount di `/api/v1/usaha`, jadi
  // `use('*')` akan membajak prefix itu dan list/detail publik jadi 401.
  const authPaths = ['/claims/mine', '/claims/:id', '/:slug/claims'];
  for (const p of authPaths) {
    routes.use(p, rateLimit({ points: 60, duration: 60 }));
    routes.use(p, deps.authenticate);
  }

  const submitRoute = createRoute({
    method: 'post',
    path: '/:slug/claims',
    tags: ['Usaha claims'],
    summary: 'Ajukan klaim pengelolaan usaha (wajib login)',
    request: {
      params: claimSlugParamSchema,
      body: { content: { 'application/json': { schema: submitClaimBodySchema } } },
    },
    responses: {
      200: { description: 'Klaim diajukan', content: json(okPublic) },
      400: { description: 'Body tidak valid', content: json(errorResponseSchema) },
      404: { description: 'Usaha tidak ditemukan', content: json(errorResponseSchema) },
      409: { description: 'Sudah jadi pengelola / klaim pending', content: json(errorResponseSchema) },
    },
  });

  const mineRoute = createRoute({
    method: 'get',
    path: '/claims/mine',
    tags: ['Usaha claims'],
    summary: 'Klaim milik user login',
    responses: {
      200: { description: 'Daftar klaim', content: json(okPublicList) },
    },
  });

  const cancelRoute = createRoute({
    method: 'delete',
    path: '/claims/:id',
    tags: ['Usaha claims'],
    summary: 'Batalkan klaim sendiri saat masih pending',
    request: { params: claimIdParamSchema },
    responses: {
      200: { description: 'Dibatalkan', content: json(okNullResponseSchema) },
      404: { description: 'Tidak ditemukan', content: json(errorResponseSchema) },
      409: { description: 'Bukan klaim pending', content: json(errorResponseSchema) },
    },
  });

  routes.openapi(submitRoute, (c) =>
    deps.controller.submit(c, c.req.param('slug'), c.req.valid('json')) as never,
  );
  routes.openapi(mineRoute, (c) => deps.controller.mine(c) as never);
  routes.openapi(cancelRoute, (c) =>
    deps.controller.cancel(c, c.req.param('id')) as never,
  );
  return routes;
}

export function createAdminUsahaClaimRoutes(deps: {
  controller: UsahaClaimController;
  authenticate: MiddlewareHandler<{ Variables: AppVariables }>;
}) {
  const routes = createOpenApiApp();
  routes.use('*', rateLimit({ points: 60, duration: 60 }));
  routes.use('*', deps.authenticate, authorizeRole('root', 'admin', 'reviewer'));

  const listRoute = createRoute({
    method: 'get',
    path: '/',
    tags: ['Admin usaha claims'],
    summary: 'Antrean klaim (termasuk bukti kontak, admin saja)',
    request: { query: listClaimsQuerySchema },
    responses: {
      200: { description: 'Daftar klaim', content: json(okAdminList) },
    },
  });

  const approveRoute = createRoute({
    method: 'post',
    path: '/:id/approve',
    tags: ['Admin usaha claims'],
    summary: 'Setujui klaim (klaim pending lain otomatis ditolak)',
    request: { params: claimIdParamSchema },
    responses: {
      200: { description: 'Disetujui', content: json(okNullResponseSchema) },
      409: { description: 'Sudah ditinjau', content: json(errorResponseSchema) },
    },
  });

  const rejectRoute = createRoute({
    method: 'post',
    path: '/:id/reject',
    tags: ['Admin usaha claims'],
    request: {
      params: claimIdParamSchema,
      body: { content: { 'application/json': { schema: rejectClaimBodySchema } } },
    },
    responses: {
      200: { description: 'Ditolak', content: json(okNullResponseSchema) },
      409: { description: 'Sudah ditinjau', content: json(errorResponseSchema) },
    },
  });

  routes.openapi(listRoute, (c) =>
    deps.controller.listAdmin(c, c.req.valid('query')) as never,
  );
  routes.openapi(approveRoute, (c) =>
    deps.controller.approve(c, c.req.param('id')) as never,
  );
  routes.openapi(rejectRoute, (c) =>
    deps.controller.reject(c, c.req.param('id'), c.req.valid('json')) as never,
  );
  return routes;
}
