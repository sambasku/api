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
import type { AboutController } from './about.controller';
import {
  adminSponsorshipListResponseSchema,
  contributorsListQuerySchema,
  contributorsListResponseSchema,
  createSponsorshipBodySchema,
  listAdminSponsorshipsQuerySchema,
  sponsorshipItemResponseSchema,
  sponsorshipListResponseSchema,
  teamListResponseSchema,
  updateSponsorshipBodySchema,
  verifiersListResponseSchema,
} from './validators/about.validator';

const json = <T extends z.ZodType>(schema: T) => ({
  'application/json': { schema },
});

export function createPublicAboutRoutes(deps: { controller: AboutController }) {
  const routes = createOpenApiApp();
  routes.use('*', rateLimit({ points: 100, duration: 60 }));

  const teamRoute = createRoute({
    method: 'get',
    path: '/team',
    tags: ['About'],
    summary: 'Daftar Tim Kami (users.is_team)',
    responses: {
      200: { description: 'Tim', content: json(teamListResponseSchema) },
    },
  });

  const sponsorshipsRoute = createRoute({
    method: 'get',
    path: '/sponsorships',
    tags: ['About'],
    summary: 'Daftar Sponsor & Mitra (aktif)',
    responses: {
      200: { description: 'Sponsorships', content: json(sponsorshipListResponseSchema) },
    },
  });

  routes.openapi(teamRoute, (c) => deps.controller.listTeam(c) as never);
  routes.openapi(sponsorshipsRoute, (c) =>
    deps.controller.listPublicSponsorships(c) as never,
  );
  return routes;
}

/** Mount di /api/v1/users - path /contributors & /verifiers sebelum /:username. */
export function createPublicAboutUserListRoutes(deps: {
  controller: AboutController;
}) {
  const routes = createOpenApiApp();
  routes.use('*', rateLimit({ points: 100, duration: 60 }));

  const contributorsRoute = createRoute({
    method: 'get',
    path: '/contributors',
    tags: ['Users'],
    summary: 'Daftar kontributor (role contributor), nama flat + cursor',
    request: { query: contributorsListQuerySchema },
    responses: {
      200: {
        description: 'Kontributor',
        content: json(contributorsListResponseSchema),
      },
    },
  });

  const verifiersRoute = createRoute({
    method: 'get',
    path: '/verifiers',
    tags: ['Users'],
    summary: 'Daftar verifikator (role reviewer) untuk apresiasi',
    responses: {
      200: {
        description: 'Verifikator',
        content: json(verifiersListResponseSchema),
      },
    },
  });

  routes.openapi(contributorsRoute, (c) =>
    deps.controller.listContributors(c, c.req.valid('query')) as never,
  );
  routes.openapi(verifiersRoute, (c) => deps.controller.listVerifiers(c) as never);
  return routes;
}

export function createAdminSponsorshipRoutes(deps: {
  controller: AboutController;
  authenticate: MiddlewareHandler<{ Variables: AppVariables }>;
}) {
  const routes = createOpenApiApp();
  routes.use(
    '*',
    deps.authenticate,
    authorizeRole('admin', 'root'),
    rateLimit({ points: 60, duration: 60 }),
  );

  const idParam = z.object({ id: z.string().length(26) });

  const listRoute = createRoute({
    method: 'get',
    path: '/',
    tags: ['Admin Sponsorships'],
    summary: 'List sponsorships (admin)',
    request: { query: listAdminSponsorshipsQuerySchema },
    responses: {
      200: {
        description: 'Daftar',
        content: json(adminSponsorshipListResponseSchema),
      },
    },
  });

  const createRouteDef = createRoute({
    method: 'post',
    path: '/',
    tags: ['Admin Sponsorships'],
    summary: 'Buat sponsorship',
    request: {
      body: { content: json(createSponsorshipBodySchema) },
    },
    responses: {
      200: { description: 'Dibuat', content: json(sponsorshipItemResponseSchema) },
      400: { description: 'Body invalid', content: json(errorResponseSchema) },
    },
  });

  const updateRoute = createRoute({
    method: 'patch',
    path: '/:id',
    tags: ['Admin Sponsorships'],
    summary: 'Edit sponsorship',
    request: {
      params: idParam,
      body: { content: json(updateSponsorshipBodySchema) },
    },
    responses: {
      200: { description: 'Diperbarui', content: json(sponsorshipItemResponseSchema) },
      404: { description: 'Tidak ditemukan', content: json(errorResponseSchema) },
    },
  });

  const deleteRoute = createRoute({
    method: 'delete',
    path: '/:id',
    tags: ['Admin Sponsorships'],
    summary: 'Soft-delete sponsorship',
    request: { params: idParam },
    responses: {
      200: { description: 'Terhapus', content: json(okNullResponseSchema) },
      404: { description: 'Tidak ditemukan', content: json(errorResponseSchema) },
    },
  });

  routes.openapi(listRoute, (c) =>
    deps.controller.listAdminSponsorships(c, c.req.valid('query')) as never,
  );
  routes.openapi(createRouteDef, (c) =>
    deps.controller.createSponsorship(c, c.req.valid('json')) as never,
  );
  routes.openapi(updateRoute, (c) =>
    deps.controller.updateSponsorship(
      c,
      c.req.param('id'),
      c.req.valid('json'),
    ) as never,
  );
  routes.openapi(deleteRoute, (c) =>
    deps.controller.deleteSponsorship(c, c.req.param('id')) as never,
  );

  return routes;
}
