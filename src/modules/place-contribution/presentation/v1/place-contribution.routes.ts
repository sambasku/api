import type { Context, MiddlewareHandler } from 'hono';
import { bodyLimit } from 'hono/body-limit';
import { createRoute } from '@hono/zod-openapi';
import { z } from 'zod';
import { authorizeRole } from '@/shared/middlewares/authorize-role.middleware';
import { rateLimit } from '@/shared/middlewares/rate-limit.middleware';
import { createOpenApiApp } from '@/shared/openapi/openapi-app';
import { errorResponseSchema, okNullResponseSchema } from '@/shared/openapi/error-response.schema';
import type { AppVariables } from '@/shared/types';
import type { PlaceContributionController } from './place-contribution.controller';
import { submitContributionBodySchema } from './place-contribution.validator';

const json = <T extends z.ZodType>(schema: T) => ({
  'application/json': { schema },
});
const idParam = z.object({ id: z.string().min(1).max(64) });
const okItem = z.object({ success: z.literal(true), data: z.object({ id: z.string() }).passthrough() });
const okList = z.object({
  success: z.literal(true),
  data: z.object({ items: z.array(z.object({ id: z.string() }).passthrough()) }),
});

export function createPlaceContributionRoutes(deps: {
  controller: PlaceContributionController;
  authenticate: MiddlewareHandler<{ Variables: AppVariables }>;
  /** Tanpa token, usulan diatribusikan ke user sistem anonim. */
  optionalAuthenticate: MiddlewareHandler<{ Variables: AppVariables }>;
  uploadPlaceImage: (c: Context) => Promise<Response> | Response;
}) {
  const routes = createOpenApiApp();
  routes.use('*', rateLimit({ points: 30, duration: 60 }));
  routes.use('*', async (c, next) => {
    if (c.req.path.endsWith('/images')) return next();
    if (c.req.method === 'POST') return deps.optionalAuthenticate(c, next);
    return deps.authenticate(c, next);
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

  const submitRoute = createRoute({
    method: 'post',
    path: '/',
    tags: ['Place contributions'],
    summary: 'Kirim usulan wisata (menunggu tinjauan)',
    request: { body: { content: { 'application/json': { schema: submitContributionBodySchema } } } },
    responses: {
      200: { description: 'Usulan tersimpan', content: json(okItem) },
      400: { description: 'Body tidak valid', content: json(errorResponseSchema) },
      409: { description: 'Batas atau bentrok', content: json(errorResponseSchema) },
    },
  });
  const mineRoute = createRoute({
    method: 'get',
    path: '/mine',
    tags: ['Place contributions'],
    summary: 'Usulan milik user login',
    responses: { 200: { description: 'Daftar usulan', content: json(okList) } },
  });
  const cancelRoute = createRoute({
    method: 'delete',
    path: '/:id',
    tags: ['Place contributions'],
    summary: 'Batalkan usulan yang masih menunggu',
    request: { params: idParam },
    responses: {
      200: { description: 'Dibatalkan', content: json(okNullResponseSchema) },
      404: { description: 'Tidak ditemukan', content: json(errorResponseSchema) },
    },
  });

  const uploadRoute = createRoute({
    method: 'post',
    path: '/images',
    tags: ['Place contributions'],
    summary: 'Unggah foto usulan tanpa login',
    responses: {
      201: { description: 'Foto tersimpan', content: json(z.object({ success: z.literal(true) }).passthrough()) },
      400: { description: 'File tidak valid', content: json(errorResponseSchema) },
    },
  });

  routes.openapi(uploadRoute, (c) => deps.uploadPlaceImage(c) as never);
  routes.openapi(submitRoute, (c) => deps.controller.submit(c, c.req.valid('json')) as never);
  routes.openapi(mineRoute, (c) => deps.controller.mine(c) as never);
  routes.openapi(cancelRoute, (c) => deps.controller.cancel(c, c.req.param('id')) as never);
  return routes;
}

export function createAdminPlaceContributionRoutes(deps: {
  controller: PlaceContributionController;
  authenticate: MiddlewareHandler<{ Variables: AppVariables }>;
}) {
  const routes = createOpenApiApp();
  routes.use('*', rateLimit({ points: 60, duration: 60 }));
  routes.use('*', deps.authenticate, authorizeRole('root', 'admin', 'reviewer'));

  const listRoute = createRoute({
    method: 'get',
    path: '/',
    tags: ['Admin place contributions'],
    summary: 'Usulan wisata yang menunggu',
    responses: { 200: { description: 'Daftar', content: json(okList) } },
  });
  const approveRoute = createRoute({
    method: 'post',
    path: '/:id/approve',
    tags: ['Admin place contributions'],
    request: { params: idParam },
    responses: {
      200: { description: 'Disetujui', content: json(okNullResponseSchema) },
      409: { description: 'Usulan basi atau bentrok', content: json(errorResponseSchema) },
    },
  });
  const rejectRoute = createRoute({
    method: 'post',
    path: '/:id/reject',
    tags: ['Admin place contributions'],
    request: { params: idParam },
    responses: { 200: { description: 'Ditolak', content: json(okNullResponseSchema) } },
  });

  routes.openapi(listRoute, (c) => deps.controller.listPending(c) as never);
  routes.openapi(approveRoute, (c) => deps.controller.approve(c, c.req.param('id')) as never);
  routes.openapi(rejectRoute, (c) => deps.controller.reject(c, c.req.param('id')) as never);
  return routes;
}
