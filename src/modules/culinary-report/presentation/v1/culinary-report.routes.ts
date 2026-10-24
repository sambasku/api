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
import type { CulinaryReportController } from './culinary-report.controller';
import {
  culinaryReportSchema,
  listReportsQuerySchema,
  reportIdParamSchema,
  reportSlugParamSchema,
  resolveReportBodySchema,
  submitReportBodySchema,
} from './validators/culinary-report.validator';

const json = <T extends z.ZodType>(schema: T) => ({
  'application/json': { schema },
});

const okItem = z.object({ success: z.literal(true), data: culinaryReportSchema });
const okList = z.object({
  success: z.literal(true),
  data: z.object({ items: z.array(culinaryReportSchema) }),
});

/**
 * Route laporan di-mount relatif terhadap `/culinary`:
 * POST /cuisines/:slug/reports, POST /places/:slug/reports
 */
export function createCulinaryReportRoutes(deps: {
  controller: CulinaryReportController;
  authenticate: MiddlewareHandler<{ Variables: AppVariables }>;
}) {
  const routes = createOpenApiApp();
  for (const p of ['/cuisines/:slug/reports', '/places/:slug/reports']) {
    routes.use(p, rateLimit({ points: 30, duration: 60 }));
    routes.use(p, deps.authenticate);
  }

  const submitCuisineRoute = createRoute({
    method: 'post',
    path: '/cuisines/:slug/reports',
    tags: ['Culinary reports'],
    summary: 'Laporkan data kuliner (wajib login)',
    request: {
      params: reportSlugParamSchema,
      body: {
        content: { 'application/json': { schema: submitReportBodySchema } },
      },
    },
    responses: {
      200: { description: 'Laporan terkirim', content: json(okItem) },
      400: { description: 'Body tidak valid', content: json(errorResponseSchema) },
      404: { description: 'Kuliner tidak ditemukan', content: json(errorResponseSchema) },
      409: { description: 'Laporan masih terbuka', content: json(errorResponseSchema) },
    },
  });

  const submitPlaceRoute = createRoute({
    method: 'post',
    path: '/places/:slug/reports',
    tags: ['Culinary reports'],
    summary: 'Laporkan data tempat kuliner (wajib login)',
    request: {
      params: reportSlugParamSchema,
      body: {
        content: { 'application/json': { schema: submitReportBodySchema } },
      },
    },
    responses: {
      200: { description: 'Laporan terkirim', content: json(okItem) },
      400: { description: 'Body tidak valid', content: json(errorResponseSchema) },
      404: { description: 'Tempat tidak ditemukan', content: json(errorResponseSchema) },
      409: { description: 'Laporan masih terbuka', content: json(errorResponseSchema) },
    },
  });

  routes.openapi(submitCuisineRoute, (c) =>
    deps.controller.submit(c, 'cuisine', c.req.param('slug'), c.req.valid('json')) as never,
  );
  routes.openapi(submitPlaceRoute, (c) =>
    deps.controller.submit(c, 'place', c.req.param('slug'), c.req.valid('json')) as never,
  );
  return routes;
}

export function createAdminCulinaryReportRoutes(deps: {
  controller: CulinaryReportController;
  authenticate: MiddlewareHandler<{ Variables: AppVariables }>;
}) {
  const routes = createOpenApiApp();
  routes.use('*', rateLimit({ points: 60, duration: 60 }));
  routes.use('*', deps.authenticate, authorizeRole('root', 'admin', 'reviewer'));

  const listRoute = createRoute({
    method: 'get',
    path: '/',
    tags: ['Admin culinary reports'],
    summary: 'Antrean laporan kuliner',
    request: { query: listReportsQuerySchema },
    responses: {
      200: { description: 'Daftar laporan', content: json(okList) },
    },
  });

  const resolveRoute = createRoute({
    method: 'post',
    path: '/:id/resolve',
    tags: ['Admin culinary reports'],
    request: {
      params: reportIdParamSchema,
      body: { content: { 'application/json': { schema: resolveReportBodySchema } } },
    },
    responses: {
      200: { description: 'Ditindaklanjuti', content: json(okNullResponseSchema) },
      409: { description: 'Sudah ditindaklanjuti', content: json(errorResponseSchema) },
    },
  });

  routes.openapi(listRoute, (c) =>
    deps.controller.listAdmin(c, c.req.valid('query')) as never,
  );
  routes.openapi(resolveRoute, (c) =>
    deps.controller.resolve(c, c.req.param('id'), c.req.valid('json')) as never,
  );
  return routes;
}
