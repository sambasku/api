import type { Context, MiddlewareHandler } from 'hono';
import { createRoute } from '@hono/zod-openapi';
import { bodyLimit } from 'hono/body-limit';
import { z } from 'zod';
import { authorizeRole } from '@/shared/middlewares/authorize-role.middleware';
import { rateLimit } from '@/shared/middlewares/rate-limit.middleware';
import { createOpenApiApp } from '@/shared/openapi/openapi-app';
import {
  errorResponseSchema,
  okNullResponseSchema,
} from '@/shared/openapi/error-response.schema';
import type { AppVariables } from '@/shared/types';
import type { CulinaryContributionController } from './culinary-contribution.controller';
import {
  approveCulinaryContributionBodySchema,
  culinaryContributionResponseSchema,
  listCulinaryContributionsQuerySchema,
  rejectCulinaryContributionBodySchema,
  requestCulinaryRevisionBodySchema,
  submitCulinaryChangeBodySchema,
  submitCulinaryContributionBodySchema,
} from './validators/culinary-contribution.validator';

const json = <T extends z.ZodType>(schema: T) => ({
  'application/json': { schema },
});

const idParam = z.object({ id: z.string().min(1).max(64) });

const okItem = z.object({
  success: z.literal(true),
  data: culinaryContributionResponseSchema,
});
const okList = z.object({
  success: z.literal(true),
  data: z.object({ items: z.array(culinaryContributionResponseSchema) }),
});

export function createCulinaryContributionRoutes(deps: {
  controller: CulinaryContributionController;
  authenticate: MiddlewareHandler<{ Variables: AppVariables }>;
  /** Tanpa token, usulan diatribusikan ke user sistem anonim. */
  optionalAuthenticate: MiddlewareHandler<{ Variables: AppVariables }>;
  /** Unggah foto usulan kuliner (anonim boleh, pola event). */
  uploadCulinaryImage: (c: Context) => Promise<Response> | Response;
}) {
  const routes = createOpenApiApp();
  routes.use('*', rateLimit({ points: 30, duration: 60 }));
  routes.use('*', async (c, next) => {
    if (c.req.method === 'POST' || c.req.method === 'PUT') {
      return deps.optionalAuthenticate(c, next);
    }
    return deps.authenticate(c, next);
  });

  // Usulan anonim: 5/jam per IP (pola event/usaha contribution).
  const anonSubmitLimit = rateLimit({ points: 5, duration: 60 * 60 });
  routes.use('*', async (c, next) => {
    const isWrite = c.req.method === 'POST' || c.req.method === 'PUT';
    if (!isWrite || c.get('user')) return next();
    return anonSubmitLimit(c, next);
  });
  // Unggah foto anonim: 10/jam per IP (1 foto per usulan + margin).
  const anonImageLimit = rateLimit({ points: 10, duration: 60 * 60 });
  routes.use('/images', async (c, next) => {
    if (c.req.method !== 'POST' || c.get('user')) return next();
    return anonImageLimit(c, next);
  });
  routes.use(
    '/images',
    bodyLimit({
      maxSize: 6 * 1024 * 1024,
      onError: (c) =>
        c.json(
          {
            success: false as const,
            error_code: 'IMAGE_TOO_LARGE',
            message: 'File gambar terlalu besar (maks 5 MB)',
          },
          400,
        ),
    }),
  );

  const uploadImageRoute = createRoute({
    method: 'post',
    path: '/images',
    tags: ['Culinary contributions'],
    summary: 'Unggah foto usulan kuliner (boleh tanpa login) - multipart field `file`',
    responses: {
      201: {
        description: 'Foto tersimpan',
        content: json(z.object({ success: z.literal(true) }).passthrough()),
      },
      400: { description: 'File tidak valid', content: json(errorResponseSchema) },
    },
  });

  const submitRoute = createRoute({
    method: 'post',
    path: '/',
    tags: ['Culinary contributions'],
    summary: 'Kirim usulan kuliner/tempat baru (boleh tanpa login)',
    request: {
      body: {
        content: {
          'application/json': { schema: submitCulinaryContributionBodySchema },
        },
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
    tags: ['Culinary contributions'],
    summary: 'Usulan milik user login',
    responses: {
      200: { description: 'Daftar usulan', content: json(okList) },
    },
  });

  const changeRoute = createRoute({
    method: 'post',
    path: '/change',
    tags: ['Culinary contributions'],
    summary: 'Pengajuan perbaikan data / hubungan kuliner-tempat',
    request: {
      body: {
        content: { 'application/json': { schema: submitCulinaryChangeBodySchema } },
      },
    },
    responses: {
      200: { description: 'Pengajuan tersimpan', content: json(okItem) },
      400: { description: 'Body tidak valid', content: json(errorResponseSchema) },
      403: { description: 'Bukan pengelola', content: json(errorResponseSchema) },
      409: {
        description: 'Field-lock / batas pengajuan',
        content: json(errorResponseSchema),
      },
    },
  });

  const cancelRoute = createRoute({
    method: 'delete',
    path: '/:id',
    tags: ['Culinary contributions'],
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
    tags: ['Culinary contributions'],
    summary: 'Kirim ulang usulan yang diminta revisi',
    request: {
      params: idParam,
      body: {
        content: {
          'application/json': { schema: submitCulinaryContributionBodySchema },
        },
      },
    },
    responses: {
      200: { description: 'Usulan terkirim ulang', content: json(okItem) },
      400: { description: 'Body tidak valid', content: json(errorResponseSchema) },
      409: { description: 'Bukan usulan revisi', content: json(errorResponseSchema) },
    },
  });

  routes.openapi(submitRoute, (c) =>
    deps.controller.submitNew(c, c.req.valid('json')) as never,
  );
  routes.openapi(mineRoute, (c) => deps.controller.mine(c) as never);
  routes.openapi(changeRoute, (c) =>
    deps.controller.submitChange(c, c.req.valid('json')) as never,
  );
  routes.openapi(cancelRoute, (c) =>
    deps.controller.cancel(c, c.req.param('id')) as never,
  );
  routes.openapi(resubmitRoute, (c) =>
    deps.controller.resubmit(c, c.req.param('id'), c.req.valid('json')) as never,
  );
  routes.openapi(uploadImageRoute, (c) => deps.uploadCulinaryImage(c) as never);
  return routes;
}

export function createAdminCulinaryContributionRoutes(deps: {
  controller: CulinaryContributionController;
  authenticate: MiddlewareHandler<{ Variables: AppVariables }>;
}) {
  const routes = createOpenApiApp();
  routes.use('*', rateLimit({ points: 60, duration: 60 }));
  routes.use('*', deps.authenticate, authorizeRole('root', 'admin', 'reviewer'));

  const listRoute = createRoute({
    method: 'get',
    path: '/',
    tags: ['Admin culinary contributions'],
    summary: 'Antrean pengajuan kuliner',
    request: { query: listCulinaryContributionsQuerySchema },
    responses: {
      200: { description: 'Daftar pengajuan', content: json(okList) },
    },
  });

  const approveRoute = createRoute({
    method: 'post',
    path: '/:id/approve',
    tags: ['Admin culinary contributions'],
    request: {
      params: idParam,
      body: {
        required: false,
        content: {
          'application/json': { schema: approveCulinaryContributionBodySchema },
        },
      },
    },
    responses: {
      200: { description: 'Disetujui', content: json(okNullResponseSchema) },
      409: { description: 'Basi atau bentrok', content: json(errorResponseSchema) },
    },
  });

  const rejectRoute = createRoute({
    method: 'post',
    path: '/:id/reject',
    tags: ['Admin culinary contributions'],
    request: {
      params: idParam,
      body: {
        content: {
          'application/json': { schema: rejectCulinaryContributionBodySchema },
        },
      },
    },
    responses: {
      200: { description: 'Ditolak', content: json(okNullResponseSchema) },
    },
  });

  const revisionRoute = createRoute({
    method: 'post',
    path: '/:id/request-revision',
    tags: ['Admin culinary contributions'],
    request: {
      params: idParam,
      body: {
        content: {
          'application/json': { schema: requestCulinaryRevisionBodySchema },
        },
      },
    },
    responses: {
      200: { description: 'Revisi diminta', content: json(okNullResponseSchema) },
    },
  });

  routes.openapi(listRoute, (c) =>
    deps.controller.listAdmin(c, c.req.valid('query')) as never,
  );
  routes.openapi(approveRoute, (c) =>
    deps.controller.approve(c, c.req.param('id'), c.req.valid('json')) as never,
  );
  routes.openapi(rejectRoute, (c) =>
    deps.controller.reject(c, c.req.param('id'), c.req.valid('json')) as never,
  );
  routes.openapi(revisionRoute, (c) =>
    deps.controller.requestRevision(c, c.req.param('id'), c.req.valid('json')) as never,
  );
  return routes;
}
