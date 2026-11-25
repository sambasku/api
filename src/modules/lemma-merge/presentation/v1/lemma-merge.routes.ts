import { createRoute } from '@hono/zod-openapi';
import { createOpenApiApp } from '@/shared/openapi/openapi-app';
import { errorResponseSchema } from '@/shared/openapi/error-response.schema';
import { rateLimit } from '@/shared/middlewares/rate-limit.middleware';
import { authorizeRole } from '@/shared/middlewares/authorize-role.middleware';
import type { AppVariables } from '@/shared/types';
import type { LemmaMergeController } from './lemma-merge.controller';
import {
  createLemmaMergeBodySchema,
  lemmaMergeIdParamSchema,
  lemmaMergeResponseSchema,
  rejectLemmaMergeBodySchema,
} from './lemma-merge.validator';

const json = <T extends import('zod').ZodType>(schema: T) => ({
  'application/json': { schema },
});

export function createLemmaMergeRoutes(deps: {
  controller: LemmaMergeController;
  authenticate: import('hono').MiddlewareHandler<{ Variables: AppVariables }>;
  requireApprovedClient?: import('hono').MiddlewareHandler<{ Variables: AppVariables }>;
}) {
  const routes = createOpenApiApp();
  routes.use('*', deps.authenticate);
  if (deps.requireApprovedClient) {
    routes.use('*', deps.requireApprovedClient);
  }
  routes.use('*', rateLimit({ points: 30, duration: 60 }));

  const createRouteDef = createRoute({
    method: 'post',
    path: '/lemma-merges',
    tags: ['Words', 'Lemma merge'],
    summary: 'Gabung entri lemma serupa (#318)',
    request: { body: { content: json(createLemmaMergeBodySchema) } },
    responses: {
      200: { description: 'Verifikator: langsung digabung', content: json(lemmaMergeResponseSchema) },
      201: { description: 'Kontributor: pending moderasi', content: json(lemmaMergeResponseSchema) },
      400: { description: 'Validasi / aturan gabung', content: json(errorResponseSchema) },
      401: { description: 'Belum login', content: json(errorResponseSchema) },
      409: { description: 'Konflik antrean', content: json(errorResponseSchema) },
    },
  });

  routes.openapi(createRouteDef, (c) =>
    deps.controller.createMerge(c, c.req.valid('json')) as never,
  );

  routes.use(
    '/lemma-merges/:id/approve',
    authorizeRole('admin', 'root', 'reviewer'),
    rateLimit({ points: 30, duration: 60 }),
  );
  routes.use(
    '/lemma-merges/:id/reject',
    authorizeRole('admin', 'root', 'reviewer'),
    rateLimit({ points: 30, duration: 60 }),
  );

  const approveBodySchema = rejectLemmaMergeBodySchema;

  const approveDef = createRoute({
    method: 'post',
    path: '/lemma-merges/{id}/approve',
    tags: ['Words', 'Lemma merge'],
    summary: 'Setujui usulan gabung lemma',
    request: {
      params: lemmaMergeIdParamSchema,
      body: { content: json(approveBodySchema) },
    },
    responses: {
      200: { description: 'Disetujui', content: json(lemmaMergeResponseSchema) },
      404: { description: 'Tidak ditemukan', content: json(errorResponseSchema) },
      409: { description: 'Sudah diproses', content: json(errorResponseSchema) },
    },
  });

  const rejectDef = createRoute({
    method: 'post',
    path: '/lemma-merges/{id}/reject',
    tags: ['Words', 'Lemma merge'],
    summary: 'Tolak usulan gabung lemma',
    request: {
      params: lemmaMergeIdParamSchema,
      body: { content: json(rejectLemmaMergeBodySchema) },
    },
    responses: {
      200: { description: 'Ditolak' },
      404: { description: 'Tidak ditemukan', content: json(errorResponseSchema) },
    },
  });

  routes.openapi(approveDef, (c) => {
    const id = c.req.valid('param').id;
    const body = c.req.valid('json') as { review_note?: string } | undefined;
    return deps.controller.approveMerge(c, id, body?.review_note) as never;
  });
  routes.openapi(rejectDef, (c) => {
    const id = c.req.valid('param').id;
    const body = c.req.valid('json');
    return deps.controller.rejectMerge(c, id, body.review_note) as never;
  });

  return routes;
}