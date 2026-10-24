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
import type { UsahaReportController } from './usaha-report.controller';
import {
  listReportsQuerySchema,
  reportIdParamSchema,
  reportSlugParamSchema,
  resolveReportBodySchema,
  submitReportBodySchema,
  usahaReportSchema,
} from './validators/usaha-report.validator';

const json = <T extends z.ZodType>(schema: T) => ({
  'application/json': { schema },
});

const okItem = z.object({ success: z.literal(true), data: usahaReportSchema });
const okList = z.object({
  success: z.literal(true),
  data: z.object({ items: z.array(usahaReportSchema) }),
});

/** POST /usaha/:slug/reports - di-mount relatif ke `/usaha`. */
export function createUsahaReportRoutes(deps: {
  controller: UsahaReportController;
  authenticate: MiddlewareHandler<{ Variables: AppVariables }>;
}) {
  const routes = createOpenApiApp();
  // Scope ke `/:slug/reports` saja: sub-app di-mount di `/api/v1/usaha`,
  // jadi `use('*')` akan membajak list/detail publik (401).
  routes.use('/:slug/reports', rateLimit({ points: 30, duration: 60 }));
  routes.use('/:slug/reports', deps.authenticate);

  const submitRoute = createRoute({
    method: 'post',
    path: '/:slug/reports',
    tags: ['Usaha reports'],
    summary: 'Laporkan info usaha (wajib login)',
    request: {
      params: reportSlugParamSchema,
      body: { content: { 'application/json': { schema: submitReportBodySchema } } },
    },
    responses: {
      200: { description: 'Laporan terkirim', content: json(okItem) },
      400: { description: 'Body tidak valid', content: json(errorResponseSchema) },
      404: { description: 'Usaha tidak ditemukan', content: json(errorResponseSchema) },
      409: { description: 'Laporan masih terbuka', content: json(errorResponseSchema) },
    },
  });

  routes.openapi(submitRoute, (c) =>
    deps.controller.submit(c, c.req.param('slug'), c.req.valid('json')) as never,
  );
  return routes;
}

export function createAdminUsahaReportRoutes(deps: {
  controller: UsahaReportController;
  authenticate: MiddlewareHandler<{ Variables: AppVariables }>;
}) {
  const routes = createOpenApiApp();
  routes.use('*', rateLimit({ points: 60, duration: 60 }));
  routes.use('*', deps.authenticate, authorizeRole('root', 'admin', 'reviewer'));

  const listRoute = createRoute({
    method: 'get',
    path: '/',
    tags: ['Admin usaha reports'],
    summary: 'Antrean laporan usaha',
    request: { query: listReportsQuerySchema },
    responses: {
      200: { description: 'Daftar laporan', content: json(okList) },
    },
  });

  const resolveRoute = createRoute({
    method: 'post',
    path: '/:id/resolve',
    tags: ['Admin usaha reports'],
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
