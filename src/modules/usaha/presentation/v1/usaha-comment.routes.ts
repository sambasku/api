import type { MiddlewareHandler } from 'hono';
import { bodyLimit } from 'hono/body-limit';
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
import type { UsahaController } from './usaha.controller';
import {
  createUsahaCommentBodySchema,
  updateUsahaCommentBodySchema,
  usahaCommentResponseSchema,
  usahaCommentsQuerySchema,
} from './validators/usaha.validator';

const json = <T extends z.ZodType>(schema: T) => ({
  'application/json': { schema },
});

const idParam = z.object({ id: z.string().min(1).max(64) });
const commentIdParam = z.object({ id: z.string().min(1).max(64) });
const commentListSchema = z.object({
  success: z.literal(true),
  data: z.object({
    items: z.array(usahaCommentResponseSchema),
    next_cursor: z.string().nullable(),
    has_more: z.boolean(),
  }),
});
const commentItemSchema = z.object({
  success: z.literal(true),
  data: usahaCommentResponseSchema,
});

export function createPublicUsahaCommentRoutes(deps: {
  controller: UsahaController;
  authenticate: MiddlewareHandler<{ Variables: AppVariables }>;
  optionalAuthenticate: MiddlewareHandler<{ Variables: AppVariables }>;
}) {
  const routes = createOpenApiApp();
  routes.use('*', rateLimit({ points: 120, duration: 60 }));

  const listRoute = createRoute({
    method: 'get',
    path: '/:id/comments',
    tags: ['Usaha Comments'],
    summary: 'List komentar usaha (publik)',
    request: { params: idParam, query: usahaCommentsQuerySchema },
    responses: {
      200: { description: 'Daftar komentar', content: json(commentListSchema) },
    },
  });

  const createRoute_ = createRoute({
    method: 'post',
    path: '/:id/comments',
    tags: ['Usaha Comments'],
    summary: 'Tambah komentar usaha (login)',
    request: {
      params: idParam,
      body: { content: json(createUsahaCommentBodySchema) },
    },
    responses: {
      201: { description: 'Komentar dibuat', content: json(commentItemSchema) },
      401: { description: 'Tidak terautentikasi', content: json(errorResponseSchema) },
      404: { description: 'Usaha tidak ditemukan', content: json(errorResponseSchema) },
    },
  });

  const updateRoute_ = createRoute({
    method: 'patch',
    path: '/comments/:id',
    tags: ['Usaha Comments'],
    summary: 'Edit komentar (penulis sendiri)',
    request: {
      params: commentIdParam,
      body: { content: json(updateUsahaCommentBodySchema) },
    },
    responses: {
      200: { description: 'Komentar diperbarui', content: json(commentItemSchema) },
      401: { description: 'Tidak terautentikasi', content: json(errorResponseSchema) },
      404: { description: 'Komentar tidak ditemukan', content: json(errorResponseSchema) },
    },
  });

  const deleteRoute_ = createRoute({
    method: 'delete',
    path: '/comments/:id',
    tags: ['Usaha Comments'],
    summary: 'Hapus komentar (penulis sendiri)',
    request: { params: commentIdParam },
    responses: {
      200: { description: 'Terhapus', content: json(okNullResponseSchema) },
      401: { description: 'Tidak terautentikasi', content: json(errorResponseSchema) },
      404: { description: 'Komentar tidak ditemukan', content: json(errorResponseSchema) },
    },
  });

  const createAudioRoute = createRoute({
    method: 'post',
    path: '/:id/comments/audio',
    tags: ['Usaha Comments'],
    summary: 'Komentar usaha dengan rekaman suara (multipart; publish langsung)',
    request: { params: idParam },
    responses: {
      201: { description: 'Komentar dibuat', content: json(commentItemSchema) },
      401: { description: 'Tidak terautentikasi', content: json(errorResponseSchema) },
      404: { description: 'Usaha tidak ditemukan', content: json(errorResponseSchema) },
    },
  });

  routes.use('/:id/comments', deps.optionalAuthenticate);
  routes.use('/:id/comments/audio', deps.authenticate, bodyLimit({
    maxSize: 6 * 1024 * 1024,
    onError: (c) =>
      c.json(
        {
          success: false as const,
          error_code: 'AUDIO_TOO_LARGE',
          message: 'File audio terlalu besar (maks 5 MB)',
        },
        400,
      ),
  }));
  routes.use('/comments/:id', deps.authenticate);

  routes.openapi(listRoute, (c) => deps.controller.listComments(c) as never);
  routes.openapi(createRoute_, (c) => deps.controller.createComment(c) as never);
  routes.openapi(createAudioRoute, (c) => deps.controller.createCommentAudio(c) as never);
  routes.openapi(updateRoute_, (c) => deps.controller.updateComment(c) as never);
  routes.openapi(deleteRoute_, (c) => deps.controller.deleteComment(c) as never);
  return routes;
}

export function createAdminUsahaCommentRoutes(deps: {
  controller: UsahaController;
  authenticate: MiddlewareHandler<{ Variables: AppVariables }>;
}) {
  const routes = createOpenApiApp();
  routes.use('*', rateLimit({ points: 60, duration: 60 }));
  routes.use('*', deps.authenticate, authorizeRole('root', 'admin', 'reviewer'));

  const takedownRoute = createRoute({
    method: 'post',
    path: '/comments/:id/takedown',
    tags: ['Admin Usaha Comments'],
    summary: 'Takedown komentar usaha (admin)',
    request: { params: commentIdParam },
    responses: {
      200: { description: 'Takedown berhasil', content: json(okNullResponseSchema) },
      404: { description: 'Komentar tidak ditemukan', content: json(errorResponseSchema) },
    },
  });

  routes.openapi(takedownRoute, (c) => deps.controller.takedownComment(c) as never);
  return routes;
}