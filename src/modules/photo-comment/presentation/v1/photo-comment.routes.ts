import type { MiddlewareHandler } from 'hono';
import { createRoute } from '@hono/zod-openapi';
import { z } from 'zod';
import { entityCommentEditHistoryResponseSchema } from '@/shared/comment/entity-comment-response.schema';
import { authorizeRole } from '@/shared/middlewares/authorize-role.middleware';
import { rateLimit } from '@/shared/middlewares/rate-limit.middleware';
import { createOpenApiApp } from '@/shared/openapi/openapi-app';
import {
  errorResponseSchema,
  okNullResponseSchema,
} from '@/shared/openapi/error-response.schema';
import type { AppVariables } from '@/shared/types';
import type { PhotoCommentController } from './photo-comment.controller';
import {
  createPhotoCommentBodySchema,
  photoCommentCountsQuerySchema,
  photoCommentIdParamSchema,
  photoCommentResponseSchema,
  photoCommentsQuerySchema,
  photoParamsSchema,
  updatePhotoCommentBodySchema,
} from './validators/photo-comment.validator';

const json = <T extends z.ZodType>(schema: T) => ({
  'application/json': { schema },
});

const commentListSchema = z.object({
  success: z.literal(true),
  data: z.object({
    items: z.array(photoCommentResponseSchema),
    next_cursor: z.string().nullable(),
    has_more: z.boolean(),
  }),
});
const commentItemSchema = z.object({
  success: z.literal(true),
  data: photoCommentResponseSchema,
});
const countsSchema = z.object({
  success: z.literal(true),
  data: z.object({ counts: z.record(z.string(), z.number().int()) }),
});

/** Komentar foto UGC (#387): `/api/v1/photos/...`. */
export function createPublicPhotoCommentRoutes(deps: {
  controller: PhotoCommentController;
  authenticate: MiddlewareHandler<{ Variables: AppVariables }>;
  optionalAuthenticate: MiddlewareHandler<{ Variables: AppVariables }>;
}) {
  const routes = createOpenApiApp();
  routes.use('*', rateLimit({ points: 120, duration: 60 }));

  const listRoute = createRoute({
    method: 'get',
    path: '/:kind/:ref/comments',
    tags: ['Photo Comments'],
    summary: 'List komentar foto (publik)',
    request: { params: photoParamsSchema, query: photoCommentsQuerySchema },
    responses: {
      200: { description: 'Daftar komentar', content: json(commentListSchema) },
    },
  });

  const createRoute_ = createRoute({
    method: 'post',
    path: '/:kind/:ref/comments',
    tags: ['Photo Comments'],
    summary: 'Tambah komentar foto (login)',
    request: {
      params: photoParamsSchema,
      body: { content: json(createPhotoCommentBodySchema) },
    },
    responses: {
      201: { description: 'Komentar dibuat', content: json(commentItemSchema) },
      401: { description: 'Tidak terautentikasi', content: json(errorResponseSchema) },
      404: { description: 'Foto tidak ditemukan', content: json(errorResponseSchema) },
    },
  });

  const countsRoute = createRoute({
    method: 'get',
    path: '/comment-counts',
    tags: ['Photo Comments'],
    summary: 'Jumlah komentar per foto (badge galeri, 1 query)',
    request: { query: photoCommentCountsQuerySchema },
    responses: {
      200: { description: 'Peta ref -> jumlah', content: json(countsSchema) },
    },
  });

  const editHistoryRoute = createRoute({
    method: 'get',
    path: '/comments/:id/edit-history',
    tags: ['Photo Comments'],
    summary: 'Riwayat sunting komentar foto',
    request: { params: photoCommentIdParamSchema },
    responses: {
      200: {
        description: 'Riwayat sunting',
        content: json(entityCommentEditHistoryResponseSchema),
      },
      404: { description: 'Tidak ditemukan', content: json(errorResponseSchema) },
    },
  });

  const updateRoute_ = createRoute({
    method: 'patch',
    path: '/comments/:id',
    tags: ['Photo Comments'],
    summary: 'Edit komentar foto (penulis sendiri)',
    request: {
      params: photoCommentIdParamSchema,
      body: { content: json(updatePhotoCommentBodySchema) },
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
    tags: ['Photo Comments'],
    summary: 'Hapus komentar foto (penulis sendiri)',
    request: { params: photoCommentIdParamSchema },
    responses: {
      200: { description: 'Terhapus', content: json(okNullResponseSchema) },
      401: { description: 'Tidak terautentikasi', content: json(errorResponseSchema) },
      404: { description: 'Komentar tidak ditemukan', content: json(errorResponseSchema) },
    },
  });

  routes.use('/:kind/:ref/comments', deps.optionalAuthenticate);
  routes.use('/comments/:id', deps.authenticate);

  routes.openapi(listRoute, (c) => deps.controller.listComments(c) as never);
  routes.openapi(createRoute_, (c) => deps.controller.createComment(c) as never);
  routes.openapi(countsRoute, (c) => deps.controller.commentCounts(c) as never);
  routes.openapi(editHistoryRoute, (c) => deps.controller.getCommentEditHistory(c) as never);
  routes.openapi(updateRoute_, (c) => deps.controller.updateComment(c) as never);
  routes.openapi(deleteRoute_, (c) => deps.controller.deleteComment(c) as never);
  return routes;
}

export function createAdminPhotoCommentRoutes(deps: {
  controller: PhotoCommentController;
  authenticate: MiddlewareHandler<{ Variables: AppVariables }>;
}) {
  const routes = createOpenApiApp();
  routes.use('*', rateLimit({ points: 60, duration: 60 }));
  routes.use('*', deps.authenticate, authorizeRole('root', 'admin', 'reviewer'));

  const takedownRoute = createRoute({
    method: 'post',
    path: '/comments/:id/takedown',
    tags: ['Admin Photo Comments'],
    summary: 'Takedown komentar foto (admin)',
    request: { params: photoCommentIdParamSchema },
    responses: {
      200: { description: 'Takedown berhasil', content: json(okNullResponseSchema) },
      404: { description: 'Komentar tidak ditemukan', content: json(errorResponseSchema) },
    },
  });

  routes.openapi(takedownRoute, (c) => deps.controller.takedownComment(c) as never);
  return routes;
}
