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
import type { CulinaryClaimController } from './culinary-claim.controller';
import {
  adminCulinaryClaimSchema,
  claimIdParamSchema,
  claimSlugParamSchema,
  listClaimsQuerySchema,
  publicCulinaryClaimSchema,
  rejectClaimBodySchema,
  submitClaimBodySchema,
} from './validators/culinary-claim.validator';

const json = <T extends z.ZodType>(schema: T) => ({
  'application/json': { schema },
});

const okPublic = z.object({ success: z.literal(true), data: publicCulinaryClaimSchema });
const okPublicList = z.object({
  success: z.literal(true),
  data: z.object({ items: z.array(publicCulinaryClaimSchema) }),
});
const okAdminList = z.object({
  success: z.literal(true),
  data: z.object({ items: z.array(adminCulinaryClaimSchema) }),
});

/**
 * Route klaim di-mount relatif terhadap `/culinary`:
 * POST /places/:slug/claims, GET /places/claims/mine, DELETE /places/claims/:id
 */
export function createCulinaryClaimRoutes(deps: {
  controller: CulinaryClaimController;
  authenticate: MiddlewareHandler<{ Variables: AppVariables }>;
}) {
  const routes = createOpenApiApp();
  // Scope ke path klaim saja: sub-app di-mount di `/api/v1/culinary`, jadi
  // `use('*')` akan membajak prefix itu dan list/detail publik jadi 401.
  const authPaths = ['/places/claims/mine', '/places/claims/:id', '/places/:slug/claims'];
  for (const p of authPaths) {
    routes.use(p, rateLimit({ points: 60, duration: 60 }));
    routes.use(p, deps.authenticate);
  }

  const submitRoute = createRoute({
    method: 'post',
    path: '/places/:slug/claims',
    tags: ['Culinary claims'],
    summary: 'Ajukan klaim pengelolaan tempat kuliner (wajib login)',
    request: {
      params: claimSlugParamSchema,
      body: { content: { 'application/json': { schema: submitClaimBodySchema } } },
    },
    responses: {
      200: { description: 'Klaim diajukan', content: json(okPublic) },
      400: { description: 'Body tidak valid', content: json(errorResponseSchema) },
      404: { description: 'Tempat tidak ditemukan', content: json(errorResponseSchema) },
      409: { description: 'Sudah jadi pengelola / klaim pending', content: json(errorResponseSchema) },
    },
  });

  const mineRoute = createRoute({
    method: 'get',
    path: '/places/claims/mine',
    tags: ['Culinary claims'],
    summary: 'Klaim milik user login',
    responses: {
      200: { description: 'Daftar klaim', content: json(okPublicList) },
    },
  });

  const cancelRoute = createRoute({
    method: 'delete',
    path: '/places/claims/:id',
    tags: ['Culinary claims'],
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

export function createAdminCulinaryClaimRoutes(deps: {
  controller: CulinaryClaimController;
  authenticate: MiddlewareHandler<{ Variables: AppVariables }>;
}) {
  const routes = createOpenApiApp();
  routes.use('*', rateLimit({ points: 60, duration: 60 }));
  routes.use('*', deps.authenticate, authorizeRole('root', 'admin', 'reviewer'));

  const listRoute = createRoute({
    method: 'get',
    path: '/',
    tags: ['Admin culinary claims'],
    summary: 'Antrean klaim (termasuk bukti kontak, admin saja)',
    request: { query: listClaimsQuerySchema },
    responses: {
      200: { description: 'Daftar klaim', content: json(okAdminList) },
    },
  });

  const approveRoute = createRoute({
    method: 'post',
    path: '/:id/approve',
    tags: ['Admin culinary claims'],
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
    tags: ['Admin culinary claims'],
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
