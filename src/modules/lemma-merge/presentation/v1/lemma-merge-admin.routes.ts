import type { MiddlewareHandler } from 'hono';
import { createRoute } from '@hono/zod-openapi';
import { z } from 'zod';
import { authorizeRole } from '@/shared/middlewares/authorize-role.middleware';
import { rateLimit } from '@/shared/middlewares/rate-limit.middleware';
import { errorResponseSchema } from '@/shared/openapi/error-response.schema';
import { createOpenApiApp } from '@/shared/openapi/openapi-app';
import { opaqueId } from '@/shared/validation/id';
import type { AppVariables, AuthUser } from '@/shared/types';
import type { LemmaMergeController } from './lemma-merge.controller';
import {
  adminListLemmaMergesQuerySchema,
  lemmaMergeDetailResponseSchema,
  lemmaMergeListResponseSchema,
  lemmaMergeResponseSchema,
  rejectLemmaMergeBodySchema,
} from './lemma-merge.validator';
import { readOptionalReviewNote } from './lemma-merge-admin-route-utils';

const json = <T extends z.ZodType>(schema: T) => ({ 'application/json': { schema } });

export function createAdminLemmaMergeRoutes(deps: {
  controller: LemmaMergeController;
  authenticate: MiddlewareHandler<{ Variables: AppVariables }>;
}) {
  const routes = createOpenApiApp();

  const adminGuard = [
    deps.authenticate,
    authorizeRole('admin', 'root', 'reviewer'),
    rateLimit({
      points: 100,
      duration: 60,
      keyFn: (c) => {
        const user = (c.get('user') as AuthUser | undefined) ?? null;
        return `admin-lemma-merge:${user?.user_id ?? c.req.header('x-forwarded-for') ?? 'unknown'}`;
      },
    }),
  ] as const;

  routes.use('/lemma-merges', ...adminGuard);
  routes.use('/lemma-merges/:id', ...adminGuard);
  routes.use('/lemma-merges/:id/approve', ...adminGuard);
  routes.use('/lemma-merges/:id/reject', ...adminGuard);

  const listRoute = createRoute({
    method: 'get',
    path: '/lemma-merges',
    tags: ['Admin', 'Lemma merge'],
    summary: 'Daftar usulan gabung lemma (#318)',
    request: { query: adminListLemmaMergesQuerySchema },
    responses: {
      200: { description: 'Daftar usulan', content: json(lemmaMergeListResponseSchema) },
      401: { description: 'Belum login', content: json(errorResponseSchema) },
      403: { description: 'Tidak diizinkan', content: json(errorResponseSchema) },
    },
  });

  routes.openapi(listRoute, ((c: any) => {
    const q = c.req.valid('query');
    return deps.controller.listMergesAdmin(c, {
      limit: q.limit,
      cursor: q.cursor,
      status: q.status,
    });
  }) as never);

  const detailRoute = createRoute({
    method: 'get',
    path: '/lemma-merges/:id',
    tags: ['Admin', 'Lemma merge'],
    summary: 'Detail usulan gabung lemma',
    request: { params: z.object({ id: opaqueId }) },
    responses: {
      200: { description: 'Detail usulan', content: json(lemmaMergeDetailResponseSchema) },
      404: { description: 'Tidak ditemukan', content: json(errorResponseSchema) },
    },
  });

  routes.openapi(detailRoute, ((c: any) => {
    const { id } = c.req.valid('param');
    return deps.controller.getMergeDetailAdmin(c, id);
  }) as never);

  const approveDef = createRoute({
    method: 'post',
    path: '/lemma-merges/{id}/approve',
    tags: ['Admin', 'Lemma merge'],
    summary: 'Setujui usulan gabung',
    request: { params: z.object({ id: opaqueId }) },
    responses: {
      200: { description: 'Disetujui', content: json(lemmaMergeResponseSchema) },
      404: { description: 'Tidak ditemukan', content: json(errorResponseSchema) },
      409: { description: 'Sudah diproses', content: json(errorResponseSchema) },
    },
  });

  const rejectDef = createRoute({
    method: 'post',
    path: '/lemma-merges/{id}/reject',
    tags: ['Admin', 'Lemma merge'],
    summary: 'Tolak usulan gabung',
    request: {
      params: z.object({ id: opaqueId }),
      body: { content: json(rejectLemmaMergeBodySchema) },
    },
    responses: {
      200: { description: 'Ditolak' },
      404: { description: 'Tidak ditemukan', content: json(errorResponseSchema) },
    },
  });

  routes.openapi(approveDef, async (c) => {
    const { id } = c.req.valid('param');
    const reviewNote = await readOptionalReviewNote(c);
    return deps.controller.approveMerge(c, id, reviewNote) as never;
  });
  routes.openapi(rejectDef, async (c) => {
    const { id } = c.req.valid('param');
    const reviewNote = await readOptionalReviewNote(c);
    return deps.controller.rejectMerge(c, id, reviewNote) as never;
  });

  return routes;
}