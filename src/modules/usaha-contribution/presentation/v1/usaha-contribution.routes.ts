import type { MiddlewareHandler } from 'hono';
import { createRoute } from '@hono/zod-openapi';
import { z } from 'zod';
import { authorizeRole } from '@/shared/middlewares/authorize-role.middleware';
import { rateLimit } from '@/shared/middlewares/rate-limit.middleware';
import { createOpenApiApp } from '@/shared/openapi/openapi-app';
import {
  errorResponseSchema,
  okNullResponseSchema,
} from '@/shared/openapi/error-response.schema';
import type { AppVariables } from '@/shared/types';
import type { UsahaContributionController } from './usaha-contribution.controller';
import {
  listUsahaContributionsQuerySchema,
  rejectUsahaContributionBodySchema,
  requestUsahaRevisionBodySchema,
  submitManagerChangeBodySchema,
  submitUsahaContributionBodySchema,
  usahaContributionResponseSchema,
} from './validators/usaha-contribution.validator';

const json = <T extends z.ZodType>(schema: T) => ({
  'application/json': { schema },
});

const idParam = z.object({ id: z.string().min(1).max(64) });

const okItem = z.object({
  success: z.literal(true),
  data: usahaContributionResponseSchema,
});
const okList = z.object({
  success: z.literal(true),
  data: z.object({ items: z.array(usahaContributionResponseSchema) }),
});

export function createUsahaContributionRoutes(deps: {
  controller: UsahaContributionController;
  authenticate: MiddlewareHandler<{ Variables: AppVariables }>;
  /** Tanpa token, usulan diatribusikan ke user sistem anonim. */
  optionalAuthenticate: MiddlewareHandler<{ Variables: AppVariables }>;
}) {
  const routes = createOpenApiApp();
  routes.use('*', rateLimit({ points: 30, duration: 60 }));
  routes.use('*', async (c, next) => {
    if (c.req.method === 'POST') return deps.optionalAuthenticate(c, next);
    return deps.authenticate(c, next);
  });

  // Usulan anonim: 5/jam per IP (pola event-contribution).
  const anonSubmitLimit = rateLimit({ points: 5, duration: 60 * 60 });
  routes.use('*', async (c, next) => {
    if (c.req.method !== 'POST' || c.get('user')) return next();
    return anonSubmitLimit(c, next);
  });

  const submitRoute = createRoute({
    method: 'post',
    path: '/',
    tags: ['Usaha contributions'],
    summary: 'Kirim usulan usaha baru (boleh tanpa login)',
    request: {
      body: {
        content: { 'application/json': { schema: submitUsahaContributionBodySchema } },
      },
    },
    responses: {
      200: { description: 'Usulan tersimpan', content: json(okItem) },
      400: { description: 'Body tidak valid', content: json(errorResponseSchema) },
      409: { description: 'Batas usulan', content: json(errorResponseSchema) },
    },
  });

  const mineRoute = createRoute({
    method: 'get',
    path: '/mine',
    tags: ['Usaha contributions'],
    summary: 'Usulan milik user login',
    responses: {
      200: { description: 'Daftar usulan', content: json(okList) },
    },
  });

  const managerRoute = createRoute({
    method: 'post',
    path: '/manager',
    tags: ['Usaha contributions'],
    summary: 'Pengajuan perubahan pengelola (profil/katalog/operasional/arsip)',
    request: {
      body: { content: { 'application/json': { schema: submitManagerChangeBodySchema } } },
    },
    responses: {
      200: { description: 'Pengajuan tersimpan', content: json(okItem) },
      400: { description: 'Body tidak valid', content: json(errorResponseSchema) },
      403: { description: 'Bukan pengelola', content: json(errorResponseSchema) },
      409: { description: 'Field-lock / batas pengajuan', content: json(errorResponseSchema) },
    },
  });

  const cancelRoute = createRoute({
    method: 'delete',
    path: '/:id',
    tags: ['Usaha contributions'],
    summary: 'Batalkan usulan/pengajuan yang belum ditinjau',
    request: { params: idParam },
    responses: {
      200: { description: 'Dibatalkan', content: json(okNullResponseSchema) },
      404: { description: 'Tidak ditemukan', content: json(errorResponseSchema) },
    },
  });

  const resubmitRoute = createRoute({
    method: 'put',
    path: '/:id',
    tags: ['Usaha contributions'],
    summary: 'Kirim ulang usulan yang diminta revisi',
    request: {
      params: idParam,
      body: {
        content: { 'application/json': { schema: submitUsahaContributionBodySchema } },
      },
    },
    responses: {
      200: { description: 'Usulan terkirim ulang', content: json(okItem) },
      400: { description: 'Body tidak valid', content: json(errorResponseSchema) },
      409: { description: 'Bukan usulan revisi', content: json(errorResponseSchema) },
    },
  });

  routes.openapi(submitRoute, (c) =>
    deps.controller.submit(c, c.req.valid('json')) as never,
  );
  routes.openapi(mineRoute, (c) => deps.controller.mine(c) as never);
  routes.openapi(managerRoute, (c) =>
    deps.controller.managerChange(c, c.req.valid('json')) as never,
  );
  routes.openapi(cancelRoute, (c) =>
    deps.controller.cancel(c, c.req.param('id')) as never,
  );
  routes.openapi(resubmitRoute, (c) =>
    deps.controller.resubmit(c, c.req.param('id'), c.req.valid('json')) as never,
  );
  return routes;
}

export function createAdminUsahaContributionRoutes(deps: {
  controller: UsahaContributionController;
  authenticate: MiddlewareHandler<{ Variables: AppVariables }>;
}) {
  const routes = createOpenApiApp();
  routes.use('*', rateLimit({ points: 60, duration: 60 }));
  routes.use('*', deps.authenticate, authorizeRole('root', 'admin', 'reviewer'));

  const listRoute = createRoute({
    method: 'get',
    path: '/',
    tags: ['Admin usaha contributions'],
    summary: 'Antrean pengajuan usaha',
    request: { query: listUsahaContributionsQuerySchema },
    responses: {
      200: { description: 'Daftar pengajuan', content: json(okList) },
    },
  });

  const approveRoute = createRoute({
    method: 'post',
    path: '/:id/approve',
    tags: ['Admin usaha contributions'],
    request: { params: idParam },
    responses: {
      200: { description: 'Disetujui', content: json(okNullResponseSchema) },
      409: { description: 'Basi atau bentrok', content: json(errorResponseSchema) },
    },
  });

  const rejectRoute = createRoute({
    method: 'post',
    path: '/:id/reject',
    tags: ['Admin usaha contributions'],
    request: {
      params: idParam,
      body: { content: { 'application/json': { schema: rejectUsahaContributionBodySchema } } },
    },
    responses: {
      200: { description: 'Ditolak', content: json(okNullResponseSchema) },
    },
  });

  const revisionRoute = createRoute({
    method: 'post',
    path: '/:id/request-revision',
    tags: ['Admin usaha contributions'],
    request: {
      params: idParam,
      body: { content: { 'application/json': { schema: requestUsahaRevisionBodySchema } } },
    },
    responses: {
      200: { description: 'Revisi diminta', content: json(okNullResponseSchema) },
    },
  });

  routes.openapi(listRoute, (c) =>
    deps.controller.listAdmin(c, c.req.valid('query')) as never,
  );
  routes.openapi(approveRoute, (c) =>
    deps.controller.approve(c, c.req.param('id')) as never,
  );
  routes.openapi(rejectRoute, (c) =>
    deps.controller.reject(c, c.req.param('id'), c.req.valid('json')) as never,
  );
  routes.openapi(revisionRoute, (c) =>
    deps.controller.requestRevision(c, c.req.param('id'), c.req.valid('json')) as never,
  );
  return routes;
}
