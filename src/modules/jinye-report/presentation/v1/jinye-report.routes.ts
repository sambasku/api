import type { MiddlewareHandler } from 'hono';
import { createRoute } from '@hono/zod-openapi';
import { z } from 'zod';
import { authorizeRole } from '@/shared/middlewares/authorize-role.middleware';
import { rateLimit } from '@/shared/middlewares/rate-limit.middleware';
import { createOpenApiApp } from '@/shared/openapi/openapi-app';
import { errorResponseSchema } from '@/shared/openapi/error-response.schema';
import type { AppVariables, AuthUser } from '@/shared/types';
import type { JinyeReportController } from './jinye-report.controller';
import {
  createJinyeReportResponseSchema,
  jinyeReportIdParamSchema,
  jinyeReportItemResponseSchema,
  jinyeReportListResponseSchema,
  listJinyeReportsQuerySchema,
  resolveJinyeReportBodySchema,
  submitJinyeReportBodySchema,
} from './validators/jinye-report.validator';

const json = <T extends z.ZodType>(schema: T) => ({
  'application/json': { schema },
});

export interface JinyeReportRoutesDeps {
  controller: JinyeReportController;
  authenticate: MiddlewareHandler<{ Variables: AppVariables }>;
  requireLegalConsent?: MiddlewareHandler<{ Variables: AppVariables }>;
}

/** Mount di `/api/v1/jinye` path `/reports` sebelum `/:id`. */
export function createJinyeReportRoutes(deps: JinyeReportRoutesDeps) {
  const routes = createOpenApiApp();

  routes.use(
    '/reports',
    deps.authenticate,
    ...(deps.requireLegalConsent ? [deps.requireLegalConsent] : []),
    rateLimit({
      points: 10,
      duration: 3600,
      keyFn: (c) => {
        const user = (c.get('user') as AuthUser | undefined) ?? null;
        return `jinye-report:${user?.user_id ?? 'unknown'}`;
      },
    }),
  );

  const submitRoute = createRoute({
    method: 'post',
    path: '/reports',
    tags: ['Jinye', 'Jinye Reports'],
    summary: 'Laporkan Jinye/komen (login). Konten tetap tayang sampai ditinjau.',
    request: { body: { content: json(submitJinyeReportBodySchema) } },
    responses: {
      201: {
        description: 'Laporan tersimpan',
        content: json(createJinyeReportResponseSchema),
      },
      400: { description: 'Body tidak valid', content: json(errorResponseSchema) },
      401: { description: 'Unauthorized', content: json(errorResponseSchema) },
      404: { description: 'Target tidak ditemukan', content: json(errorResponseSchema) },
      409: { description: 'Laporan masih terbuka', content: json(errorResponseSchema) },
      429: { description: 'Rate limit', content: json(errorResponseSchema) },
    },
  });

  routes.openapi(submitRoute, (c) =>
    deps.controller.submit(c, c.req.valid('json')) as never,
  );

  return routes;
}

export interface AdminJinyeReportRoutesDeps {
  controller: JinyeReportController;
  authenticate: MiddlewareHandler<{ Variables: AppVariables }>;
}

/** Antrean moderasi laporan Jinye (pola admin pantun-reports). */
export function createAdminJinyeReportRoutes(deps: AdminJinyeReportRoutesDeps) {
  const routes = createOpenApiApp();

  const admin = [
    deps.authenticate,
    authorizeRole('admin', 'root', 'reviewer', 'editor'),
    rateLimit({
      points: 100,
      duration: 60,
      keyFn: (c) => {
        const user = (c.get('user') as AuthUser | undefined) ?? null;
        return `admin-jinye-report:${user?.user_id ?? 'unknown'}`;
      },
    }),
  ] as const;

  routes.use('/', ...admin);
  routes.use('/:id/resolve', ...admin);

  const listRoute = createRoute({
    method: 'get',
    path: '/',
    tags: ['Jinye Reports', 'Admin'],
    summary: 'Antrean laporan Jinye',
    request: { query: listJinyeReportsQuerySchema },
    responses: {
      200: { description: 'Daftar laporan', content: json(jinyeReportListResponseSchema) },
      401: { description: 'Token tidak ada/invalid', content: json(errorResponseSchema) },
      403: { description: 'Role tidak diizinkan', content: json(errorResponseSchema) },
    },
  });

  const resolveRoute = createRoute({
    method: 'post',
    path: '/:id/resolve',
    tags: ['Jinye Reports', 'Admin'],
    summary: 'Abaikan atau tarik Jinye lalu tutup laporan',
    request: {
      params: jinyeReportIdParamSchema,
      body: { content: json(resolveJinyeReportBodySchema) },
    },
    responses: {
      200: { description: 'Laporan ditutup', content: json(jinyeReportItemResponseSchema) },
      401: { description: 'Token tidak ada/invalid', content: json(errorResponseSchema) },
      403: { description: 'Role tidak diizinkan', content: json(errorResponseSchema) },
      404: { description: 'Laporan tidak ditemukan', content: json(errorResponseSchema) },
      409: { description: 'Laporan sudah ditutup', content: json(errorResponseSchema) },
    },
  });

  routes.openapi(listRoute, (c) => deps.controller.list(c, c.req.valid('query')) as never);
  routes.openapi(resolveRoute, (c) =>
    deps.controller.resolve(c, c.req.valid('param').id, c.req.valid('json')) as never,
  );

  return routes;
}
