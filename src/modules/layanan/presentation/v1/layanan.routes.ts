import type { MiddlewareHandler } from 'hono';
import { createRoute } from '@hono/zod-openapi';
import { z } from 'zod';
import { authorizeRole } from '@/shared/middlewares/authorize-role.middleware';
import { rateLimit } from '@/shared/middlewares/rate-limit.middleware';
import { createOpenApiApp } from '@/shared/openapi/openapi-app';
import type { AppVariables } from '@/shared/types';
import type { LayananController } from './layanan.controller';
import {
  contributionListQuerySchema,
  layananFieldsSchema,
  listLayananQuerySchema,
  rejectLayananSchema,
  revisionNoteSchema,
  submitLayananSchema,
} from './layanan.validator';

const ok = z.object({ success: z.literal(true), data: z.unknown() });
const json = { 'application/json': { schema: ok } };
const idParam = z.object({ id: z.string().min(1).max(40) });
const slugParam = z.object({ slug: z.string().min(1).max(80) });

export function createPublicLayananRoutes(deps: { controller: LayananController }) {
  const routes = createOpenApiApp();
  routes.use('*', rateLimit({ points: 120, duration: 60 }));

  routes.openapi(
    createRoute({
      method: 'get',
      path: '/',
      tags: ['Layanan'],
      request: { query: listLayananQuerySchema },
      responses: { 200: { description: 'Daftar layanan tayang', content: json } },
    }),
    (c) => deps.controller.listPublic(c, c.req.valid('query')) as never,
  );

  routes.openapi(
    createRoute({
      method: 'get',
      path: '/:slug',
      tags: ['Layanan'],
      request: { params: slugParam },
      responses: { 200: { description: 'Detail layanan', content: json } },
    }),
    (c) => deps.controller.getPublic(c, c.req.valid('param').slug) as never,
  );

  return routes;
}

export function createAdminLayananRoutes(deps: {
  controller: LayananController;
  authenticate: MiddlewareHandler<{ Variables: AppVariables }>;
}) {
  const routes = createOpenApiApp();
  routes.use('*', rateLimit({ points: 60, duration: 60 }));
  routes.use('*', deps.authenticate, authorizeRole('root', 'admin', 'reviewer'));

  routes.openapi(
    createRoute({
      method: 'get',
      path: '/',
      tags: ['Layanan'],
      responses: { 200: { description: 'Daftar kelola', content: json } },
    }),
    (c) => deps.controller.adminList(c) as never,
  );
  routes.openapi(
    createRoute({
      method: 'post',
      path: '/',
      tags: ['Layanan'],
      request: { body: { content: { 'application/json': { schema: layananFieldsSchema } } } },
      responses: { 201: { description: 'Layanan dibuat', content: json } },
    }),
    (c) => deps.controller.adminCreate(c, c.req.valid('json')) as never,
  );
  routes.openapi(
    createRoute({
      method: 'put',
      path: '/:id',
      tags: ['Layanan'],
      request: {
        params: idParam,
        body: { content: { 'application/json': { schema: layananFieldsSchema } } },
      },
      responses: { 200: { description: 'Layanan diubah', content: json } },
    }),
    (c) => deps.controller.adminUpdate(c, c.req.valid('param').id, c.req.valid('json')) as never,
  );
  for (const action of ['publish', 'unpublish'] as const) {
    routes.openapi(
      createRoute({
        method: 'post',
        path: `/:id/${action}`,
        tags: ['Layanan'],
        request: { params: idParam },
        responses: { 200: { description: action, content: json } },
      }),
      (c) => deps.controller.adminPublish(c, c.req.valid('param').id, action === 'publish') as never,
    );
  }
  return routes;
}

export function createLayananContributionRoutes(deps: {
  controller: LayananController;
  authenticate: MiddlewareHandler<{ Variables: AppVariables }>;
}) {
  const routes = createOpenApiApp();
  routes.use('*', rateLimit({ points: 30, duration: 60 }));
  routes.use('*', deps.authenticate);

  routes.openapi(
    createRoute({
      method: 'get',
      path: '/mine',
      tags: ['Layanan'],
      responses: { 200: { description: 'Usulan saya', content: json } },
    }),
    (c) => deps.controller.mine(c) as never,
  );
  routes.openapi(
    createRoute({
      method: 'post',
      path: '/',
      tags: ['Layanan'],
      request: { body: { content: { 'application/json': { schema: submitLayananSchema } } } },
      responses: { 201: { description: 'Usulan masuk', content: json } },
    }),
    (c) => deps.controller.submit(c, c.req.valid('json')) as never,
  );
  routes.openapi(
    createRoute({
      method: 'put',
      path: '/:id',
      tags: ['Layanan'],
      request: {
        params: idParam,
        body: { content: { 'application/json': { schema: layananFieldsSchema } } },
      },
      responses: { 200: { description: 'Usulan dikirim ulang', content: json } },
    }),
    (c) => deps.controller.resubmit(c, c.req.valid('param').id, c.req.valid('json')) as never,
  );
  routes.openapi(
    createRoute({
      method: 'delete',
      path: '/:id',
      tags: ['Layanan'],
      request: { params: idParam },
      responses: { 200: { description: 'Usulan dibatalkan', content: json } },
    }),
    (c) => deps.controller.cancel(c, c.req.valid('param').id) as never,
  );
  return routes;
}

export function createAdminLayananContributionRoutes(deps: {
  controller: LayananController;
  authenticate: MiddlewareHandler<{ Variables: AppVariables }>;
}) {
  const routes = createOpenApiApp();
  routes.use('*', rateLimit({ points: 60, duration: 60 }));
  routes.use('*', deps.authenticate, authorizeRole('root', 'admin', 'reviewer'));

  routes.openapi(
    createRoute({
      method: 'get',
      path: '/',
      tags: ['Layanan'],
      request: { query: contributionListQuerySchema },
      responses: { 200: { description: 'Antrean usulan', content: json } },
    }),
    (c) => deps.controller.queue(c, c.req.valid('query')) as never,
  );
  routes.openapi(
    createRoute({
      method: 'post',
      path: '/:id/approve',
      tags: ['Layanan'],
      request: { params: idParam },
      responses: { 200: { description: 'Disetujui', content: json } },
    }),
    (c) => deps.controller.approve(c, c.req.valid('param').id) as never,
  );
  routes.openapi(
    createRoute({
      method: 'post',
      path: '/:id/reject',
      tags: ['Layanan'],
      request: {
        params: idParam,
        body: { content: { 'application/json': { schema: rejectLayananSchema } } },
      },
      responses: { 200: { description: 'Ditolak', content: json } },
    }),
    (c) => deps.controller.reject(c, c.req.valid('param').id, c.req.valid('json')) as never,
  );
  routes.openapi(
    createRoute({
      method: 'post',
      path: '/:id/request-revision',
      tags: ['Layanan'],
      request: {
        params: idParam,
        body: { content: { 'application/json': { schema: revisionNoteSchema } } },
      },
      responses: { 200: { description: 'Diminta perbaikan', content: json } },
    }),
    (c) => deps.controller.revise(c, c.req.valid('param').id, c.req.valid('json')) as never,
  );
  return routes;
}
