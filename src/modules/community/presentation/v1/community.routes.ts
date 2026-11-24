import type { MiddlewareHandler } from 'hono';
import { createRoute } from '@hono/zod-openapi';
import { z } from 'zod';
import { authorizeRole } from '@/shared/middlewares/authorize-role.middleware';
import { rateLimit } from '@/shared/middlewares/rate-limit.middleware';
import { createOpenApiApp } from '@/shared/openapi/openapi-app';
import type { AppVariables } from '@/shared/types';
import type { CommunityController } from './community.controller';
import {
  adminProposalListQuerySchema,
  approveCommunityProposalSchema,
  communityOrgFieldsSchema,
  communityOrgPatchSchema,
  listCommunityQuerySchema,
  rejectCommunityProposalSchema,
  setCommunityStatusSchema,
  submitCommunityProposalSchema,
} from './community.validator';

const ok = z.object({ success: z.literal(true), data: z.unknown() });
const json = { 'application/json': { schema: ok } };
const idParam = z.object({ id: z.string().min(1).max(40) });
const slugParam = z.object({ slug: z.string().min(1).max(80) });

export function createPublicCommunityRoutes(deps: {
  controller: CommunityController;
}) {
  const routes = createOpenApiApp();
  routes.use('*', rateLimit({ points: 120, duration: 60 }));

  routes.openapi(
    createRoute({
      method: 'get',
      path: '/orgs',
      tags: ['Community'],
      request: { query: listCommunityQuerySchema },
      responses: { 200: { description: 'Daftar komunitas', content: json } },
    }),
    (c) => deps.controller.listPublic(c, c.req.valid('query')) as never,
  );

  routes.openapi(
    createRoute({
      method: 'get',
      path: '/featured',
      tags: ['Community'],
      responses: { 200: { description: 'Sorotan Tim/Sponsor', content: json } },
    }),
    (c) => deps.controller.listFeatured(c) as never,
  );

  routes.openapi(
    createRoute({
      method: 'get',
      path: '/orgs/:slug',
      tags: ['Community'],
      request: { params: slugParam },
      responses: { 200: { description: 'Detail komunitas', content: json } },
    }),
    (c) => deps.controller.getPublic(c, c.req.valid('param').slug) as never,
  );

  return routes;
}

export function createAuthCommunityRoutes(deps: {
  controller: CommunityController;
  authenticate: MiddlewareHandler<{ Variables: AppVariables }>;
}) {
  const routes = createOpenApiApp();
  routes.use('*', rateLimit({ points: 60, duration: 60 }));
  routes.use('*', deps.authenticate);

  routes.openapi(
    createRoute({
      method: 'post',
      path: '/proposals',
      tags: ['Community'],
      request: {
        body: {
          content: {
            'application/json': { schema: submitCommunityProposalSchema },
          },
        },
      },
      responses: { 201: { description: 'Usulan terkirim', content: json } },
    }),
    (c) => deps.controller.submitProposal(c, c.req.valid('json')) as never,
  );

  routes.openapi(
    createRoute({
      method: 'get',
      path: '/proposals/mine',
      tags: ['Community'],
      responses: { 200: { description: 'Usulan saya', content: json } },
    }),
    (c) => deps.controller.listMine(c) as never,
  );

  routes.openapi(
    createRoute({
      method: 'post',
      path: '/proposals/:id/cancel',
      tags: ['Community'],
      request: { params: idParam },
      responses: { 200: { description: 'Usulan dibatalkan', content: json } },
    }),
    (c) =>
      deps.controller.cancelProposal(c, c.req.valid('param').id) as never,
  );

  return routes;
}

export function createAdminCommunityOrgRoutes(deps: {
  controller: CommunityController;
  authenticate: MiddlewareHandler<{ Variables: AppVariables }>;
}) {
  const routes = createOpenApiApp();
  routes.use('*', rateLimit({ points: 60, duration: 60 }));
  routes.use('*', deps.authenticate, authorizeRole('root', 'admin', 'reviewer'));

  routes.openapi(
    createRoute({
      method: 'get',
      path: '/',
      tags: ['Community'],
      responses: { 200: { description: 'Kelola org', content: json } },
    }),
    (c) => deps.controller.adminListOrgs(c) as never,
  );

  routes.openapi(
    createRoute({
      method: 'post',
      path: '/',
      tags: ['Community'],
      request: {
        body: {
          content: {
            'application/json': { schema: communityOrgFieldsSchema },
          },
        },
      },
      responses: { 201: { description: 'Org dibuat', content: json } },
    }),
    (c) => deps.controller.adminCreateOrg(c, c.req.valid('json')) as never,
  );

  routes.openapi(
    createRoute({
      method: 'put',
      path: '/:id',
      tags: ['Community'],
      request: {
        params: idParam,
        body: {
          content: {
            'application/json': { schema: communityOrgPatchSchema },
          },
        },
      },
      responses: { 200: { description: 'Org diubah', content: json } },
    }),
    (c) =>
      deps.controller.adminUpdateOrg(
        c,
        c.req.valid('param').id,
        c.req.valid('json'),
      ) as never,
  );

  routes.openapi(
    createRoute({
      method: 'post',
      path: '/:id/status',
      tags: ['Community'],
      request: {
        params: idParam,
        body: {
          content: {
            'application/json': { schema: setCommunityStatusSchema },
          },
        },
      },
      responses: { 200: { description: 'Status diubah', content: json } },
    }),
    (c) =>
      deps.controller.adminSetStatus(
        c,
        c.req.valid('param').id,
        c.req.valid('json'),
      ) as never,
  );

  return routes;
}

export function createAdminCommunityProposalRoutes(deps: {
  controller: CommunityController;
  authenticate: MiddlewareHandler<{ Variables: AppVariables }>;
}) {
  const routes = createOpenApiApp();
  routes.use('*', rateLimit({ points: 60, duration: 60 }));
  routes.use('*', deps.authenticate, authorizeRole('root', 'admin', 'reviewer'));

  routes.openapi(
    createRoute({
      method: 'get',
      path: '/',
      tags: ['Community'],
      request: { query: adminProposalListQuerySchema },
      responses: { 200: { description: 'Daftar usulan', content: json } },
    }),
    (c) =>
      deps.controller.adminListProposals(c, c.req.valid('query')) as never,
  );

  routes.openapi(
    createRoute({
      method: 'post',
      path: '/:id/approve',
      tags: ['Community'],
      request: {
        params: idParam,
        body: {
          content: {
            'application/json': { schema: approveCommunityProposalSchema },
          },
        },
      },
      responses: { 200: { description: 'Usulan disetujui', content: json } },
    }),
    (c) =>
      deps.controller.adminApprove(
        c,
        c.req.valid('param').id,
        c.req.valid('json'),
      ) as never,
  );

  routes.openapi(
    createRoute({
      method: 'post',
      path: '/:id/reject',
      tags: ['Community'],
      request: {
        params: idParam,
        body: {
          content: {
            'application/json': { schema: rejectCommunityProposalSchema },
          },
        },
      },
      responses: { 200: { description: 'Usulan ditolak', content: json } },
    }),
    (c) =>
      deps.controller.adminReject(
        c,
        c.req.valid('param').id,
        c.req.valid('json'),
      ) as never,
  );

  return routes;
}
