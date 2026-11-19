import { createRoute, z } from '@hono/zod-openapi';
import type { MiddlewareHandler } from 'hono';
import { authorizeRole } from '@/shared/middlewares/authorize-role.middleware';
import { rateLimit } from '@/shared/middlewares/rate-limit.middleware';
import { createOpenApiApp } from '@/shared/openapi/openapi-app';
import { errorResponseSchema } from '@/shared/openapi/error-response.schema';
import type { AppVariables } from '@/shared/types';
import type { ArticleViewsController } from './article-views.controller';

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

export interface PublicArticleViewsRoutesDeps {
  controller: ArticleViewsController;
  softAuthenticate: MiddlewareHandler<{ Variables: AppVariables }>;
}

export interface AdminArticleViewsRoutesDeps {
  controller: ArticleViewsController;
  authenticate: MiddlewareHandler<{ Variables: AppVariables }>;
}

/** POST /api/v1/encyclopedia/articles/:slug/view - publik, soft auth. */
export function createPublicArticleViewsRoutes(deps: PublicArticleViewsRoutesDeps) {
  const routes = createOpenApiApp();
  routes.use('*', rateLimit({ points: 100, duration: 60 }));
  routes.use('*', deps.softAuthenticate);

  const bySlugRoute = createRoute({
    method: 'post',
    path: '/articles/:slug/view',
    tags: ['Encyclopedia'],
    summary: 'Catat view artikel (unik per pembaca per hari WIB)',
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

/** GET /api/v1/admin/encyclopedia/views(+ /daily) - root/admin/reviewer. */
export function createAdminArticleViewsRoutes(deps: AdminArticleViewsRoutesDeps) {
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
        z.object({ article_id: z.string(), views: z.number().int() }),
      ),
    }),
  });

  const viewsRoute = createRoute({
    method: 'get',
    path: '/views',
    tags: ['Encyclopedia', 'Admin'],
    summary: 'Total view per artikel (days kosong = semua waktu)',
    request: { query: viewTotalsQuery },
    responses: {
      200: {
        description: 'Total view per artikel',
        content: json(viewsResponseSchema),
      },
      401: { description: 'Unauthorized', content: json(errorResponseSchema) },
      403: { description: 'Forbidden', content: json(errorResponseSchema) },
    },
  });

  const viewsDailyRoute = createRoute({
    method: 'get',
    path: '/views/daily',
    tags: ['Encyclopedia', 'Admin'],
    summary: 'Tren harian + ranking view per artikel (analitik Console)',
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