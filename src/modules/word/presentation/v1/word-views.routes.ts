import { createRoute, z } from '@hono/zod-openapi';
import type { MiddlewareHandler } from 'hono';
import { authorizeRole } from '@/shared/middlewares/authorize-role.middleware';
import { rateLimit } from '@/shared/middlewares/rate-limit.middleware';
import { createOpenApiApp } from '@/shared/openapi/openapi-app';
import { errorResponseSchema } from '@/shared/openapi/error-response.schema';
import type { AppVariables } from '@/shared/types';
import type { WordViewsController } from './word-views.controller';

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

export interface PublicWordViewsRoutesDeps {
  controller: WordViewsController;
  softAuthenticate: MiddlewareHandler<{ Variables: AppVariables }>;
}

export interface AdminWordViewsRoutesDeps {
  controller: WordViewsController;
  authenticate: MiddlewareHandler<{ Variables: AppVariables }>;
}

/** POST /api/v1/words/:id/view + /lemma/:lemma/view - publik, soft auth. */
export function createPublicWordViewsRoutes(deps: PublicWordViewsRoutesDeps) {
  const routes = createOpenApiApp();
  routes.use('*', rateLimit({ points: 100, duration: 60 }));
  routes.use('*', deps.softAuthenticate);

  const byIdRoute = createRoute({
    method: 'post',
    path: '/:id/view',
    tags: ['Words'],
    summary: 'Catat view detail kata by id (unik per pembaca per hari WIB)',
    request: {
      params: z.object({ id: z.string().length(26) }),
    },
    responses: {
      200: {
        description: 'View tercatat (id tak dikenal = no-op)',
        content: json(okNullResponseSchema),
      },
      400: { description: 'Param tidak valid', content: json(errorResponseSchema) },
    },
  });

  const byLemmaRoute = createRoute({
    method: 'post',
    path: '/lemma/:lemma/view',
    tags: ['Words'],
    summary: 'Catat view detail kata by lemma (URL web)',
    request: {
      params: z.object({ lemma: z.string().trim().min(1).max(255) }),
    },
    responses: {
      200: {
        description: 'View tercatat (lemma tak dikenal = no-op)',
        content: json(okNullResponseSchema),
      },
      400: { description: 'Param tidak valid', content: json(errorResponseSchema) },
    },
  });

  routes.openapi(byIdRoute, (c) =>
    deps.controller.recordViewById(c, c.req.valid('param').id) as never,
  );
  routes.openapi(byLemmaRoute, (c) =>
    deps.controller.recordViewByLemma(c, c.req.valid('param').lemma) as never,
  );

  return routes;
}

/** GET /api/v1/admin/words/views(+ /daily) - root/admin/reviewer. */
export function createAdminWordViewsRoutes(deps: AdminWordViewsRoutesDeps) {
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
        z.object({ word_id: z.string(), views: z.number().int() }),
      ),
    }),
  });

  const viewsRoute = createRoute({
    method: 'get',
    path: '/views',
    tags: ['Words', 'Admin'],
    summary: 'Total view per kata (days kosong = semua waktu)',
    request: { query: viewTotalsQuery },
    responses: {
      200: {
        description: 'Total view per kata',
        content: json(viewsResponseSchema),
      },
      401: { description: 'Unauthorized', content: json(errorResponseSchema) },
      403: { description: 'Forbidden', content: json(errorResponseSchema) },
    },
  });

  const viewsDailyRoute = createRoute({
    method: 'get',
    path: '/views/daily',
    tags: ['Words', 'Admin'],
    summary: 'Tren harian + ranking view per lemma (analitik Console)',
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
