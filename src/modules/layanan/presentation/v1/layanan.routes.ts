import type { MiddlewareHandler } from 'hono';
import { createRoute } from '@hono/zod-openapi';
import { z } from 'zod';
import { authorizeRole } from '@/shared/middlewares/authorize-role.middleware';
import { rateLimit } from '@/shared/middlewares/rate-limit.middleware';
import { createOpenApiApp } from '@/shared/openapi/openapi-app';
import { errorResponseSchema } from '@/shared/openapi/error-response.schema';
import type { AppVariables } from '@/shared/types';
import type { LayananController } from './layanan.controller';
import {
  layananFieldsSchema,
  listLayananQuerySchema,
  rejectLayananSchema,
  revisionLayananSchema,
  submitLayananSchema,
} from './layanan.validator';

const json = <T extends z.ZodType>(schema: T) => ({
  'application/json': { schema },
});

const idParam = z.object({ id: z.string().min(1).max(40) });
const slugParam = z.object({ slug: z.string().min(1).max(120) });
const ok = z.object({ success: z.literal(true), data: z.unknown() });

export function createPublicLayananRoutes(deps: {
  controller: LayananController;
}) {
  const routes = createOpenApiApp();
  routes.use('*', rateLimit({ points: 120, duration: 60 }));

  const listRoute = createRoute({
    method: 'get',
    path: '/',
    tags: ['Layanan'],
    summary: 'Daftar layanan publik yang tayang',
    request: { query: listLayananQuerySchema },
    responses: {
      200: { description: 'Daftar', content: json(ok) },
    },
  });
  const getRoute = createRoute({
    method: 'get',
    path: '/:slug',
    tags: ['Layanan'],
    summary: 'Detail layanan publik',
    request: { params: slugParam },
    responses: {
      200: { description: 'Detail', content: json(ok) },
      404: { description: 'Tidak ketemu', content: json(errorResponseSchema) },
    },
  });

  routes.openapi(listRoute, (c) => deps.controller.listPublic(c, c.req.valid('query')) as never);
  routes.openapi(getRoute, (c) => deps.controller.getPublic(c, c.req.valid('param').slug) as never);
  return routes;
}

export function createAdminLayananRoutes(deps: {
  controller: LayananController;
  authenticate: MiddlewareHandler<{ Variables: AppVariables }>;
}) {
  const routes = createOpenApiApp();
  routes.use('*', rateLimit({ points: 60, duration: 60 }));
  routes.use('*', deps.authenticate, authorizeRole('root', 'admin', 'reviewer'));

  const listRoute = createRoute({
    method: 'get',
    path: '/',
    tags: ['Layanan'],
    request: { query: z.object({ region_id: z.string().optional() }) },
    responses: { 200: { description: 'Daftar admin', content: json(ok) } },
  });
  const createRouteDef = createRoute({
    method: 'post',
    path: '/',
    tags: ['Layanan'],
    request: { body: { content: json(layananFieldsSchema) } },
    responses: { 201: { description: 'Dibuat', content: json(ok) } },
  });
  const updateRoute = createRoute({
    method: 'put',
    path: '/:id',
    tags: ['Layanan'],
    request: {
      params: idParam,
      body: { content: json(layananFieldsSchema) },
    },
    responses: { 200: { description: 'Diubah', content: json(ok) } },
  });
  const unpublishRoute = createRoute({
    method: 'post',
    path: '/:id/unpublish',
    tags: ['Layanan'],
    request: { params: idParam },
    responses: { 200: { description: 'Diturunkan', content: json(ok) } },
  });
  const publishRoute = createRoute({
    method: 'post',
    path: '/:id/publish',
    tags: ['Layanan'],
    request: { params: idParam },
    responses: { 200: { description: 'Ditayangkan', content: json(ok) } },
  });

  routes.openapi(listRoute, (c) => deps.controller.adminList(c, c.req.valid('query').region_id) as never);
  routes.openapi(createRouteDef, (c) => deps.controller.adminCreate(c, c.req.valid('json')) as never);
  routes.openapi(
    updateRoute,
    (c) => deps.controller.adminUpdate(c, c.req.valid('param').id, c.req.valid('json')) as never,
  );
  routes.openapi(
    unpublishRoute,
    (c) => deps.controller.adminPublish(c, c.req.valid('param').id, false) as never,
  );
  routes.openapi(
    publishRoute,
    (c) => deps.controller.adminPublish(c, c.req.valid('param').id, true) as never,
  );
  return routes;
}

export function createLayananContributionRoutes(deps: {
  controller: LayananController;
  authenticate: MiddlewareHandler<{ Variables: AppVariables }>;
}) {
  const routes = createOpenApiApp();
  routes.use('*', rateLimit({ points: 30, duration: 60 }));
  routes.use('*', deps.authenticate);

  const submitRoute = createRoute({
    method: 'post',
    path: '/',
    tags: ['Layanan'],
    request: { body: { content: json(submitLayananSchema) } },
    responses: { 201: { description: 'Usulan masuk', content: json(ok) } },
  });
  const mineRoute = createRoute({
    method: 'get',
    path: '/mine',
    tags: ['Layanan'],
    responses: { 200: { description: 'Usulan saya', content: json(ok) } },
  });
  const resubmitRoute = createRoute({
    method: 'put',
    path: '/:id',
    tags: ['Layanan'],
    request: {
      params: idParam,
      body: { content: json(layananFieldsSchema) },
    },
    responses: { 200: { description: 'Dikirim ulang', content: json(ok) } },
  });
  const cancelRoute = createRoute({
    method: 'delete',
    path: '/:id',
    tags: ['Layanan'],
    request: { params: idParam },
    responses: { 200: { description: 'Dibatalkan', content: json(ok) } },
  });

  routes.openapi(mineRoute, (c) => deps.controller.mine(c) as never);
  routes.openapi(submitRoute, (c) => deps.controller.submit(c, c.req.valid('json')) as never);
  routes.openapi(
    resubmitRoute,
    (c) => deps.controller.resubmit(c, c.req.valid('param').id, c.req.valid('json')) as never,
  );
  routes.openapi(cancelRoute, (c) => deps.controller.cancel(c, c.req.valid('param').id) as never);
  return routes;
}

export function createAdminLayananContributionRoutes(deps: {
  controller: LayananController;
  authenticate: MiddlewareHandler<{ Variables: AppVariables }>;
}) {
  const routes = createOpenApiApp();
  routes.use('*', rateLimit({ points: 60, duration: 60 }));
  routes.use('*', deps.authenticate, authorizeRole('root', 'admin', 'reviewer'));

  const listRoute = createRoute({
    method: 'get',
    path: '/',
    tags: ['Layanan'],
    request: {
      query: z.object({
        status: z.enum(['pending', 'needs_revision', 'approved', 'rejected']).optional(),
      }),
    },
    responses: { 200: { description: 'Antrean', content: json(ok) } },
  });
  const approveRoute = createRoute({
    method: 'post',
    path: '/:id/approve',
    tags: ['Layanan'],
    request: { params: idParam },
    responses: { 200: { description: 'Disetujui', content: json(ok) } },
  });
  const rejectRoute = createRoute({
    method: 'post',
    path: '/:id/reject',
    tags: ['Layanan'],
    request: {
      params: idParam,
      body: { content: json(rejectLayananSchema) },
    },
    responses: { 200: { description: 'Ditolak', content: json(ok) } },
  });
  const reviseRoute = createRoute({
    method: 'post',
    path: '/:id/request-revision',
    tags: ['Layanan'],
    request: {
      params: idParam,
      body: { content: json(revisionLayananSchema) },
    },
    responses: { 200: { description: 'Minta revisi', content: json(ok) } },
  });

  routes.openapi(listRoute, (c) => deps.controller.queue(c, c.req.valid('query').status) as never);
  routes.openapi(approveRoute, (c) => deps.controller.approve(c, c.req.valid('param').id) as never);
  routes.openapi(rejectRoute, (c) => {
    const body = c.req.valid('json');
    return deps.controller.reject(c, c.req.valid('param').id, body.reason_code, body.reason_text) as never;
  });
  routes.openapi(reviseRoute, (c) =>
    deps.controller.revise(c, c.req.valid('param').id, c.req.valid('json').note) as never,
  );
  return routes;
}
