import type { MiddlewareHandler } from 'hono';
import { z } from 'zod';
import { createRoute } from '@hono/zod-openapi';
import { authorizeRole } from '@/shared/middlewares/authorize-role.middleware';
import { rateLimit } from '@/shared/middlewares/rate-limit.middleware';
import { createOpenApiApp } from '@/shared/openapi/openapi-app';
import { errorResponseSchema } from '@/shared/openapi/error-response.schema';
import type { AppVariables } from '@/shared/types';
import type { WordVotersController } from './word-voters.controller';
import {
  listWordVotersParamsSchema,
  listWordVotersQuerySchema,
  listWordVotersResponseSchema,
} from './validators/word-voters.validator';

const json = <T extends z.ZodType>(schema: T) => ({
  'application/json': { schema },
});

export interface WordVotersRoutesDeps {
  controller: WordVotersController;
  authenticate: MiddlewareHandler<{ Variables: AppVariables }>;
}

/** GET /api/v1/admin/words/:wordId/voters - root/admin/reviewer. */
export function createAdminWordVotersRoutes(deps: WordVotersRoutesDeps) {
  const routes = createOpenApiApp();

  routes.use(
    '/:wordId/voters',
    deps.authenticate,
    authorizeRole('root', 'admin', 'reviewer'),
    rateLimit({ points: 120, duration: 60 }),
  );

  const listRoute = createRoute({
    method: 'get',
    path: '/:wordId/voters',
    tags: ['Admin Votes', 'Words'],
    summary: 'Daftar voter makna milik satu kata (root/admin/reviewer)',
    request: {
      params: listWordVotersParamsSchema,
      query: listWordVotersQuerySchema,
    },
    responses: {
      200: {
        description: 'Daftar voter + meta cursor + total up/down',
        content: json(listWordVotersResponseSchema),
      },
      400: { description: 'Query/params tidak valid', content: json(errorResponseSchema) },
      401: { description: 'Token tidak ada/invalid', content: json(errorResponseSchema) },
      403: { description: 'Role tidak diizinkan', content: json(errorResponseSchema) },
      404: { description: 'Kata tidak ditemukan / cursor invalid', content: json(errorResponseSchema) },
    },
  });

  routes.openapi(listRoute, (c) =>
    deps.controller.list(c, c.req.valid('param'), c.req.valid('query')) as never,
  );

  return routes;
}
