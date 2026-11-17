import type { MiddlewareHandler } from 'hono';
import { createRoute } from '@hono/zod-openapi';
import { z } from 'zod';
import { authorizeRole } from '@/shared/middlewares/authorize-role.middleware';
import { rateLimit } from '@/shared/middlewares/rate-limit.middleware';
import { createOpenApiApp } from '@/shared/openapi/openapi-app';
import type { AppVariables } from '@/shared/types';
import type { BalehoController } from './baleho.controller';
import {
  balehoEventBodySchema,
  createBalehoPlacementBodySchema,
  markPaidBalehoBodySchema,
  rejectBalehoBodySchema,
} from './validators/baleho.validator';

const ok = z.object({ success: z.literal(true), data: z.unknown() });
const json = { 'application/json': { schema: ok } };
const idParam = z.object({ id: z.string().min(1).max(40) });
const slideParam = z.object({
  slide: z.coerce.number().int().min(1).max(2),
});

export function createPublicBalehoRoutes(deps: {
  controller: BalehoController;
  optionalAuthenticate: MiddlewareHandler<{ Variables: AppVariables }>;
}) {
  const routes = createOpenApiApp();
  routes.use('*', rateLimit({ points: 120, duration: 60 }));

  routes.use('*', deps.optionalAuthenticate);

  routes.openapi(
    createRoute({
      method: 'get',
      path: '/boards/{slide}',
      tags: ['Baleho'],
      request: { params: slideParam },
      responses: { 200: { description: 'Papan Baleho', content: json } },
    }),
    (c) =>
      deps.controller.getBoard(c, c.req.valid('param').slide) as never,
  );

  routes.openapi(
    createRoute({
      method: 'get',
      path: '/pricing',
      tags: ['Baleho'],
      responses: {
        200: {
          description: 'Tarif per sel 1x1 per hari',
          content: json,
        },
      },
    }),
    (c) => deps.controller.getPricing(c) as never,
  );

  routes.openapi(
    createRoute({
      method: 'post',
      path: '/events',
      tags: ['Baleho'],
      request: {
        body: { content: { 'application/json': { schema: balehoEventBodySchema } } },
      },
      responses: { 200: { description: 'Event tercatat', content: json } },
    }),
    (c) =>
      deps.controller.recordEvent(c, c.req.valid('json')) as never,
  );

  return routes;
}

export function createAuthBalehoRoutes(deps: {
  controller: BalehoController;
  authenticate: MiddlewareHandler<{ Variables: AppVariables }>;
}) {
  const routes = createOpenApiApp();
  routes.use('*', rateLimit({ points: 30, duration: 60 }));
  routes.use('*', deps.authenticate);

  routes.openapi(
    createRoute({
      method: 'post',
      path: '/placements',
      tags: ['Baleho'],
      request: {
        body: {
          content: {
            'application/json': { schema: createBalehoPlacementBodySchema },
          },
        },
      },
      responses: { 201: { description: 'Pesanan dibuat', content: json } },
    }),
    (c) =>
      deps.controller.createPlacement(c, c.req.valid('json')) as never,
  );

  routes.openapi(
    createRoute({
      method: 'get',
      path: '/creatives',
      tags: ['Baleho'],
      responses: {
        200: {
          description: 'Creative approved milik user (reaktivasi)',
          content: json,
        },
      },
    }),
    (c) => deps.controller.listMyCreatives(c) as never,
  );

  routes.openapi(
    createRoute({
      method: 'get',
      path: '/placements/mine',
      tags: ['Baleho'],
      responses: {
        200: {
          description: 'Riwayat pesanan Baleho milik user',
          content: json,
        },
      },
    }),
    (c) => deps.controller.listMyPlacements(c) as never,
  );

  return routes;
}

export function createAdminBalehoRoutes(deps: {
  controller: BalehoController;
  authenticate: MiddlewareHandler<{ Variables: AppVariables }>;
}) {
  const routes = createOpenApiApp();
  routes.use('*', rateLimit({ points: 60, duration: 60 }));
  routes.use('*', deps.authenticate, authorizeRole('root', 'admin', 'reviewer'));

  routes.openapi(
    createRoute({
      method: 'get',
      path: '/placements',
      tags: ['Baleho'],
      responses: { 200: { description: 'Daftar pesanan', content: json } },
    }),
    (c) => deps.controller.adminList(c) as never,
  );

  routes.openapi(
    createRoute({
      method: 'post',
      path: '/placements/{id}/approve',
      tags: ['Baleho'],
      request: { params: idParam },
      responses: { 200: { description: 'Disetujui → awaiting_payment', content: json } },
    }),
    (c) =>
      deps.controller.adminApprove(c, c.req.valid('param').id) as never,
  );

  routes.openapi(
    createRoute({
      method: 'post',
      path: '/placements/{id}/reject',
      tags: ['Baleho'],
      request: {
        params: idParam,
        body: {
          content: { 'application/json': { schema: rejectBalehoBodySchema } },
        },
      },
      responses: { 200: { description: 'Ditolak', content: json } },
    }),
    (c) =>
      deps.controller.adminReject(
        c,
        c.req.valid('param').id,
        c.req.valid('json'),
      ) as never,
  );

  routes.openapi(
    createRoute({
      method: 'post',
      path: '/placements/{id}/mark-paid',
      tags: ['Baleho'],
      request: {
        params: idParam,
        body: {
          content: {
            'application/json': { schema: markPaidBalehoBodySchema },
          },
        },
      },
      responses: {
        200: {
          description: 'Live setelah bayar + bukti ImageKit',
          content: json,
        },
      },
    }),
    (c) =>
      deps.controller.adminMarkPaid(
        c,
        c.req.valid('param').id,
        c.req.valid('json'),
      ) as never,
  );

  routes.openapi(
    createRoute({
      method: 'post',
      path: '/placements/{id}/pause',
      tags: ['Baleho'],
      request: {
        params: idParam,
        body: {
          content: { 'application/json': { schema: rejectBalehoBodySchema } },
        },
      },
      responses: { 200: { description: 'Pause/takedown', content: json } },
    }),
    (c) =>
      deps.controller.adminPause(
        c,
        c.req.valid('param').id,
        c.req.valid('json'),
      ) as never,
  );

  return routes;
}
