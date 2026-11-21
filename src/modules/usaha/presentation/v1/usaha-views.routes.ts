import { createRoute, z } from '@hono/zod-openapi';
import type { MiddlewareHandler } from 'hono';
import { authorizeRole } from '@/shared/middlewares/authorize-role.middleware';
import { rateLimit } from '@/shared/middlewares/rate-limit.middleware';
import { createOpenApiApp } from '@/shared/openapi/openapi-app';
import { errorResponseSchema } from '@/shared/openapi/error-response.schema';
import type { AppVariables } from '@/shared/types';
import type { UsahaViewsController } from './usaha-views.controller';

const json = <T extends z.ZodType>(schema: T) => ({
  'application/json': { schema },
});

const okNullResponseSchema = z.object({
  success: z.literal(true),
  data: z.null(),
});

const viewPeriodQuery = z.object({
  days: z.coerce.number().int().min(1).max(365).default(30),
});

const viewTotalsQuery = z.object({
  days: z.coerce.number().int().min(1).max(365).optional(),
});

export interface PublicUsahaViewsRoutesDeps {
  controller: UsahaViewsController;
  softAuthenticate: MiddlewareHandler<{ Variables: AppVariables }>;
}

export interface AdminUsahaViewsRoutesDeps {
  controller: UsahaViewsController;
  authenticate: MiddlewareHandler<{ Variables: AppVariables }>;
}

/** POST /api/v1/usaha/:slug/view - publik, soft auth. */
export function createPublicUsahaViewsRoutes(deps: PublicUsahaViewsRoutesDeps) {
  const routes = createOpenApiApp();
  routes.use('*', rateLimit({ points: 100, duration: 60 }));
  routes.use('*', deps.softAuthenticate);

  const bySlugRoute = createRoute({
    method: 'post',
    path: '/:slug/view',
    tags: ['Usaha'],
    summary: 'Catat view detail usaha (unik per pembaca per hari WIB)',
    request: {
      params: z.object({ slug: z.string().trim().min(1).max(120) }),
    },
    responses: {
      200: {
        description: 'View tercatat (slug tak dikenal = no-op)',
        content: json(okNullResponseSchema),
      },
      400: { description: 'Param tidak valid', content: json(errorResponseSchema) },
    },
  });

  routes.openapi(bySlugRoute, (c) =>
    deps.controller.recordViewBySlug(c, c.req.valid('param').slug) as never,
  );

  return routes;
}

/** GET /api/v1/admin/usaha/views(+ /daily) - root/admin/reviewer. */
export function createAdminUsahaViewsRoutes(deps: AdminUsahaViewsRoutesDeps) {
  const routes = createOpenApiApp();
  // Scope ke path views saja - jangan `*` (mount base dipakai CRUD lain).
  const adminGate = [
    deps.authenticate,
    authorizeRole('root', 'admin', 'reviewer'),
  ] as const;
  routes.use('/views', ...adminGate);
  routes.use('/views/daily', ...adminGate);

  const viewsResponseSchema = z.object({
    success: z.literal(true),
    data: z.object({
      items: z.array(
        z.object({ usaha_id: z.string(), views: z.number().int() }),
      ),
    }),
  });

  const viewsRoute = createRoute({
    method: 'get',
    path: '/views',
    tags: ['Usaha', 'Admin'],
    summary: 'Total view per usaha (days kosong = semua waktu)',
    request: { query: viewTotalsQuery },
    responses: {
      200: {
        description: 'Total view per usaha',
        content: json(viewsResponseSchema),
      },
      401: { description: 'Unauthorized', content: json(errorResponseSchema) },
      403: { description: 'Forbidden', content: json(errorResponseSchema) },
    },
  });

  const viewsDailyRoute = createRoute({
    method: 'get',
    path: '/views/daily',
    tags: ['Usaha', 'Admin'],
    summary: 'Tren harian + ranking view per usaha (analitik Console)',
    request: { query: viewPeriodQuery },
    responses: {
      200: {
        description: 'Laporan view',
        content: json(z.object({ success: z.literal(true) }).passthrough()),
      },
      401: { description: 'Unauthorized', content: json(errorResponseSchema) },
      403: { description: 'Forbidden', content: json(errorResponseSchema) },
    },
  });

  routes.openapi(viewsRoute, (c) =>
    deps.controller.listTotals(c, c.req.valid('query').days ?? null) as never,
  );
  routes.openapi(viewsDailyRoute, (c) =>
    deps.controller.listDaily(c, c.req.valid('query').days) as never,
  );

  return routes;
}