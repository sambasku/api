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
import type { Context } from 'hono';

async function readOptionalReviewNote(
  c: Context<{ Variables: AppVariables }>,
): Promise<string | undefined> {
  const contentType = c.req.header('content-type') ?? '';
  if (!contentType.includes('application/json')) {
    return undefined;
  }
  const raw: unknown = await c.req.json().catch(() => ({}));
  const parsed = rejectLemmaMergeBodySchema.safeParse(raw);
  return parsed.success ? parsed.data.review_note : undefined;
}

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

  const approveDef = createRoute({
    method: 'post',
    path: '/lemma-merges/{id}/approve',
    tags: ['Words', 'Lemma merge'],
    summary: 'Setujui usulan gabung lemma',
    request: {
      params: lemmaMergeIdParamSchema,
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
    },
    responses: {
      200: { description: 'Ditolak' },
      404: { description: 'Tidak ditemukan', content: json(errorResponseSchema) },
    },
  });

  routes.openapi(approveDef, async (c) => {
    const id = c.req.valid('param').id;
    const reviewNote = await readOptionalReviewNote(c);
    return deps.controller.approveMerge(c, id, reviewNote) as never;
  });
  routes.openapi(rejectDef, async (c) => {
    const id = c.req.valid('param').id;
    const reviewNote = await readOptionalReviewNote(c);
    return deps.controller.rejectMerge(c, id, reviewNote) as never;
  });

  return routes;
}