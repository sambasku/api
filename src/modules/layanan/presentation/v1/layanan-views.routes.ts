import { createRoute, z } from '@hono/zod-openapi';
import type { MiddlewareHandler } from 'hono';
import { authorizeRole } from '@/shared/middlewares/authorize-role.middleware';
import { rateLimit } from '@/shared/middlewares/rate-limit.middleware';
import { createOpenApiApp } from '@/shared/openapi/openapi-app';
import { errorResponseSchema } from '@/shared/openapi/error-response.schema';
import type { AppVariables } from '@/shared/types';
import type { LayananViewsController } from './layanan-views.controller';

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

export interface PublicLayananViewsRoutesDeps {
  controller: LayananViewsController;
  softAuthenticate: MiddlewareHandler<{ Variables: AppVariables }>;
}

export interface AdminLayananViewsRoutesDeps {
  controller: LayananViewsController;
  authenticate: MiddlewareHandler<{ Variables: AppVariables }>;
}

/** POST /api/v1/layanan/:slug/view - publik, soft auth. */
export function createPublicLayananViewsRoutes(deps: PublicLayananViewsRoutesDeps) {
  const routes = createOpenApiApp();
  routes.use('*', rateLimit({ points: 100, duration: 60 }));
  routes.use('*', deps.softAuthenticate);

  const bySlugRoute = createRoute({
    method: 'post',
    path: '/:slug/view',
    tags: ['Layanan'],
    summary: 'Catat view detail layanan (unik per pembaca per hari WIB)',
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

/** GET /api/v1/admin/layanan/views(+ /daily) - root/admin/reviewer. */
export function createAdminLayananViewsRoutes(deps: AdminLayananViewsRoutesDeps) {
  const routes = createOpenApiApp();
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
        z.object({ layanan_id: z.string(), views: z.number().int() }),
      ),
    }),
  });

  const viewsRoute = createRoute({
    method: 'get',
    path: '/views',
    tags: ['Layanan', 'Admin'],
    summary: 'Total view per layanan (days kosong = semua waktu)',
    request: { query: viewTotalsQuery },
    responses: {
      200: {
        description: 'Total view per layanan',
        content: json(viewsResponseSchema),
      },
      401: { description: 'Unauthorized', content: json(errorResponseSchema) },
      403: { description: 'Forbidden', content: json(errorResponseSchema) },
    },
  });

  const viewsDailyRoute = createRoute({
    method: 'get',
    path: '/views/daily',
    tags: ['Layanan', 'Admin'],
    summary: 'Tren harian + ranking view per layanan (analitik Console)',
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