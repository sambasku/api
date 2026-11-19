import { createRoute, z } from '@hono/zod-openapi';
import type { MiddlewareHandler } from 'hono';
import { authorizeRole } from '@/shared/middlewares/authorize-role.middleware';
import { rateLimit } from '@/shared/middlewares/rate-limit.middleware';
import { createOpenApiApp } from '@/shared/openapi/openapi-app';
import { errorResponseSchema } from '@/shared/openapi/error-response.schema';
import type { AppVariables } from '@/shared/types';
import type { CuisineViewsController } from './cuisine-views.controller';

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

const slugParam = z.object({ slug: z.string().trim().min(1).max(120) });

export interface PublicCuisineViewsRoutesDeps {
  controller: CuisineViewsController;
  softAuthenticate: MiddlewareHandler<{ Variables: AppVariables }>;
}

export interface AdminCuisineViewsRoutesDeps {
  controller: CuisineViewsController;
  authenticate: MiddlewareHandler<{ Variables: AppVariables }>;
}

/** POST /api/v1/culinary/cuisines/:slug/view - publik, soft auth. */
export function createPublicCuisineViewsRoutes(deps: PublicCuisineViewsRoutesDeps) {
  const routes = createOpenApiApp();
  routes.use('*', rateLimit({ points: 120, duration: 60 }));
  routes.use('*', deps.softAuthenticate);

  const bySlugRoute = createRoute({
    method: 'post',
    path: '/cuisines/:slug/view',
    tags: ['Culinary'],
    summary: 'Catat view detail kuliner (unik per pembaca per hari WIB)',
    request: { params: slugParam },
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

/** GET /api/v1/admin/culinary/views(+ /daily) - root/admin/reviewer. */
export function createAdminCuisineViewsRoutes(deps: AdminCuisineViewsRoutesDeps) {
  const routes = createOpenApiApp();
  routes.use(
    '*',
    deps.authenticate,
    authorizeRole('root', 'admin', 'reviewer'),
  );

  const viewsResponseSchema = z.object({
    success: z.literal(true),
    data: z.object({
      items: z.array(
        z.object({ cuisine_id: z.string(), views: z.number().int() }),
      ),
    }),
  });

  const viewsRoute = createRoute({
    method: 'get',
    path: '/views',
    tags: ['Culinary', 'Admin'],
    summary: 'Total view per kuliner (days kosong = semua waktu)',
    request: { query: viewTotalsQuery },
    responses: {
      200: {
        description: 'Total view per kuliner',
        content: json(viewsResponseSchema),
      },
      401: { description: 'Unauthorized', content: json(errorResponseSchema) },
      403: { description: 'Forbidden', content: json(errorResponseSchema) },
    },
  });

  const viewsDailyRoute = createRoute({
    method: 'get',
    path: '/views/daily',
    tags: ['Culinary', 'Admin'],
    summary: 'Tren harian + ranking view per kuliner (analitik Console)',
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