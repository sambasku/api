import type { MiddlewareHandler } from 'hono';
import { createRoute } from '@hono/zod-openapi';
import { z } from 'zod';
import { authorizeRole } from '@/shared/middlewares/authorize-role.middleware';
import { rateLimit } from '@/shared/middlewares/rate-limit.middleware';
import { createOpenApiApp } from '@/shared/openapi/openapi-app';
import { errorResponseSchema } from '@/shared/openapi/error-response.schema';
import type { AppVariables, AuthUser } from '@/shared/types';
import type { PantunReportController } from './pantun-report.controller';
import {
  createPantunReportResponseSchema,
  listPantunReportsQuerySchema,
  pantunReportIdParamSchema,
  pantunReportItemResponseSchema,
  pantunReportListResponseSchema,
  resolvePantunReportBodySchema,
  submitPantunReportBodySchema,
} from './validators/pantun-report.validator';

const json = <T extends z.ZodType>(schema: T) => ({
  'application/json': { schema },
});

export interface PantunReportRoutesDeps {
  controller: PantunReportController;
  authenticate: MiddlewareHandler<{ Variables: AppVariables }>;
  /** Gate persetujuan legal untuk aksi tulis (403 CONSENT_REQUIRED). */
  requireLegalConsent?: MiddlewareHandler<{ Variables: AppVariables }>;
}

/**
 * Route publik-terbatas, di-mount di `/api/v1/pantuns`:
 * POST /reports. Wajib didaftarkan SEBELUM `/:id` supaya literal menang.
 */
export function createPantunReportRoutes(deps: PantunReportRoutesDeps) {
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
        return `pantun-report:${user?.user_id ?? 'unknown'}`;
      },
    }),
  );

  const submitRoute = createRoute({
    method: 'post',
    path: '/reports',
    tags: ['Pantun', 'Pantun Reports'],
    summary: 'Laporkan pantun/balasan (login). Konten tetap tayang sampai ditinjau.',
    request: { body: { content: json(submitPantunReportBodySchema) } },
    responses: {
      201: { description: 'Laporan tersimpan', content: json(createPantunReportResponseSchema) },
      400: { description: 'Body tidak valid / melaporkan sendiri', content: json(errorResponseSchema) },
      401: { description: 'Token tidak ada/invalid', content: json(errorResponseSchema) },
      404: { description: 'Target tidak ditemukan / tidak tayang', content: json(errorResponseSchema) },
      409: { description: 'Laporan serupa masih terbuka', content: json(errorResponseSchema) },
      429: { description: 'Rate limit', content: json(errorResponseSchema) },
    },
  });

  routes.openapi(submitRoute, (c) =>
    deps.controller.submit(c, c.req.valid('json')) as never,
  );

  return routes;
}

export interface AdminPantunReportRoutesDeps {
  controller: PantunReportController;
  authenticate: MiddlewareHandler<{ Variables: AppVariables }>;
}

/** Antrean moderasi laporan pantun (pola admin word-reports). */
export function createAdminPantunReportRoutes(deps: AdminPantunReportRoutesDeps) {
  const routes = createOpenApiApp();

  const admin = [
    deps.authenticate,
    authorizeRole('admin', 'root', 'reviewer', 'editor'),
    rateLimit({
      points: 100,
      duration: 60,
      keyFn: (c) => {
        const user = (c.get('user') as AuthUser | undefined) ?? null;
        return `admin-pantun-report:${user?.user_id ?? 'unknown'}`;
      },
    }),
  ] as const;

  routes.use('/', ...admin);
  routes.use('/:id/resolve', ...admin);

  const listRoute = createRoute({
    method: 'get',
    path: '/',
    tags: ['Pantun Reports', 'Admin'],
    summary: 'Antrean laporan pantun',
    request: { query: listPantunReportsQuerySchema },
    responses: {
      200: { description: 'Daftar laporan', content: json(pantunReportListResponseSchema) },
      401: { description: 'Token tidak ada/invalid', content: json(errorResponseSchema) },
      403: { description: 'Role tidak diizinkan', content: json(errorResponseSchema) },
    },
  });

  const resolveRoute = createRoute({
    method: 'post',
    path: '/:id/resolve',
    tags: ['Pantun Reports', 'Admin'],
    summary: 'Abaikan atau tarik pantun lalu tutup laporan',
    request: {
      params: pantunReportIdParamSchema,
      body: { content: json(resolvePantunReportBodySchema) },
    },
    responses: {
      200: { description: 'Laporan ditutup', content: json(pantunReportItemResponseSchema) },
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
