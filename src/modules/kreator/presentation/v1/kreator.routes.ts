import type { MiddlewareHandler } from 'hono';
import { createRoute } from '@hono/zod-openapi';
import { z } from 'zod';
import { authorizeRole } from '@/shared/middlewares/authorize-role.middleware';
import { rateLimit } from '@/shared/middlewares/rate-limit.middleware';
import { createOpenApiApp } from '@/shared/openapi/openapi-app';
import type { AppVariables } from '@/shared/types';
import type { KreatorController } from './kreator.controller';
import {
  adminClaimsQuerySchema,
  adminKreatorBodySchema,
  adminKreatorUpdateSchema,
  claimIdParamSchema,
  creditIdParamSchema,
  kreatorIdParamSchema,
  kreatorSlugParamSchema,
  linkCreditBodySchema,
  listKreatorsQuerySchema,
  rejectKreatorClaimSchema,
  submitKreatorClaimSchema,
} from './validators/kreator.validator';

const ok = z.object({ success: z.literal(true), data: z.unknown() });
const json = { 'application/json': { schema: ok } };

export function createPublicKreatorRoutes(deps: { controller: KreatorController }) {
  const routes = createOpenApiApp();
  routes.use('*', rateLimit({ points: 120, duration: 60 }));

  routes.openapi(
    createRoute({
      method: 'get',
      path: '/',
      tags: ['Kreator'],
      request: { query: listKreatorsQuerySchema },
      responses: { 200: { description: 'Daftar kreator', content: json } },
    }),
    (c) => deps.controller.listPublic(c, c.req.valid('query')) as never,
  );

  routes.openapi(
    createRoute({
      method: 'get',
      path: '/:slug',
      tags: ['Kreator'],
      request: { params: kreatorSlugParamSchema },
      responses: { 200: { description: 'Profil + karya', content: json } },
    }),
    (c) => deps.controller.getPublic(c, c.req.valid('param').slug) as never,
  );

  return routes;
}

export function createAuthKreatorClaimRoutes(deps: {
  controller: KreatorController;
  authenticate: MiddlewareHandler<{ Variables: AppVariables }>;
}) {
  const routes = createOpenApiApp();
  routes.use('*', rateLimit({ points: 60, duration: 60 }));
  routes.use('*', deps.authenticate);

  routes.openapi(
    createRoute({
      method: 'post',
      path: '/:slug/claim',
      tags: ['Kreator'],
      request: {
        params: kreatorSlugParamSchema,
        body: { content: { 'application/json': { schema: submitKreatorClaimSchema } } },
      },
      responses: { 201: { description: 'Klaim diajukan', content: json } },
    }),
    (c) =>
      deps.controller.submitClaim(
        c,
        c.req.valid('param').slug,
        c.req.valid('json'),
      ) as never,
  );

  return routes;
}

export function createMineKreatorClaimRoutes(deps: {
  controller: KreatorController;
  authenticate: MiddlewareHandler<{ Variables: AppVariables }>;
}) {
  const routes = createOpenApiApp();
  routes.use('*', rateLimit({ points: 60, duration: 60 }));
  routes.use('*', deps.authenticate);

  routes.openapi(
    createRoute({
      method: 'get',
      path: '/mine',
      tags: ['Kreator'],
      responses: { 200: { description: 'Klaim saya', content: json } },
    }),
    (c) => deps.controller.mineClaims(c) as never,
  );

  return routes;
}

export function createAdminKreatorRoutes(deps: {
  controller: KreatorController;
  authenticate: MiddlewareHandler<{ Variables: AppVariables }>;
}) {
  const routes = createOpenApiApp();
  routes.use('*', rateLimit({ points: 60, duration: 60 }));
  routes.use('*', deps.authenticate, authorizeRole('root', 'admin', 'reviewer'));

  routes.openapi(
    createRoute({
      method: 'post',
      path: '/',
      tags: ['Admin kreator'],
      request: { body: { content: { 'application/json': { schema: adminKreatorBodySchema } } } },
      responses: { 201: { description: 'Kreator dibuat', content: json } },
    }),
    (c) => deps.controller.adminCreate(c, c.req.valid('json')) as never,
  );

  routes.openapi(
    createRoute({
      method: 'put',
      path: '/:id',
      tags: ['Admin kreator'],
      request: {
        params: kreatorIdParamSchema,
        body: { content: { 'application/json': { schema: adminKreatorUpdateSchema } } },
      },
      responses: { 200: { description: 'Kreator diubah', content: json } },
    }),
    (c) =>
      deps.controller.adminUpdate(c, c.req.valid('param').id, c.req.valid('json')) as never,
  );

  return routes;
}

export function createAdminKaryaCreditLinkRoutes(deps: {
  controller: KreatorController;
  authenticate: MiddlewareHandler<{ Variables: AppVariables }>;
}) {
  const routes = createOpenApiApp();
  routes.use('*', rateLimit({ points: 60, duration: 60 }));
  routes.use('*', deps.authenticate, authorizeRole('root', 'admin', 'reviewer'));

  routes.openapi(
    createRoute({
      method: 'post',
      path: '/:id/link',
      tags: ['Admin karya'],
      request: {
        params: creditIdParamSchema,
        body: { content: { 'application/json': { schema: linkCreditBodySchema } } },
      },
      responses: { 200: { description: 'Credit ditautkan', content: json } },
    }),
    (c) =>
      deps.controller.linkCredit(c, c.req.valid('param').id, c.req.valid('json')) as never,
  );

  return routes;
}

export function createAdminKreatorClaimRoutes(deps: {
  controller: KreatorController;
  authenticate: MiddlewareHandler<{ Variables: AppVariables }>;
}) {
  const routes = createOpenApiApp();
  routes.use('*', rateLimit({ points: 60, duration: 60 }));
  routes.use('*', deps.authenticate, authorizeRole('root', 'admin', 'reviewer'));

  routes.openapi(
    createRoute({
      method: 'get',
      path: '/',
      tags: ['Admin kreator'],
      request: { query: adminClaimsQuerySchema },
      responses: { 200: { description: 'Antrean klaim', content: json } },
    }),
    (c) => deps.controller.listAdminClaims(c, c.req.valid('query')) as never,
  );

  routes.openapi(
    createRoute({
      method: 'post',
      path: '/:id/approve',
      tags: ['Admin kreator'],
      request: { params: claimIdParamSchema },
      responses: { 200: { description: 'approve', content: json } },
    }),
    (c) => deps.controller.approveClaim(c, c.req.valid('param').id) as never,
  );

  routes.openapi(
    createRoute({
      method: 'post',
      path: '/:id/reject',
      tags: ['Admin kreator'],
      request: {
        params: claimIdParamSchema,
        body: { content: { 'application/json': { schema: rejectKreatorClaimSchema } } },
      },
      responses: { 200: { description: 'reject', content: json } },
    }),
    (c) =>
      deps.controller.rejectClaim(c, c.req.valid('param').id, c.req.valid('json')) as never,
  );

  return routes;
}