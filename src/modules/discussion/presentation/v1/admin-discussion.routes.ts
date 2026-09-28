import type { MiddlewareHandler } from 'hono';
import { createRoute } from '@hono/zod-openapi';
import { z } from 'zod';
import { authorizeRole } from '@/shared/middlewares/authorize-role.middleware';
import { rateLimit } from '@/shared/middlewares/rate-limit.middleware';
import { createOpenApiApp } from '@/shared/openapi/openapi-app';
import { errorResponseSchema } from '@/shared/openapi/error-response.schema';
import type { AppVariables } from '@/shared/types';
import type { DiscussionController } from './discussion.controller';
import {
  listAdminDiscussionsQuerySchema,
  pinDiscussionReplyBodySchema,
  rejectDiscussionBodySchema,
  discussionAdminDetailResponseSchema,
  discussionAdminItemResponseSchema,
  discussionAdminListResponseSchema,
  discussionIdParamSchema,
  discussionReplyIdParamSchema,
  discussionReplyPublicSchema,
} from './validators/discussion.validator';

const json = <T extends z.ZodType>(schema: T) => ({
  'application/json': { schema },
});

export interface AdminDiscussionRoutesDeps {
  controller: DiscussionController;
  authenticate: MiddlewareHandler<{ Variables: AppVariables }>;
}

/** Antrean moderasi: admin, root, reviewer, editor (lebih luas dari kontribusi). */
export function createAdminDiscussionRoutes(deps: AdminDiscussionRoutesDeps) {
  const routes = createOpenApiApp();

  const reviewer = [
    deps.authenticate,
    authorizeRole('admin', 'root', 'reviewer', 'editor'),
    rateLimit({ points: 500, duration: 60 }),
  ] as const;

  routes.use('/', ...reviewer);
  routes.use('/:id', ...reviewer);
  routes.use('/:id/approve', ...reviewer);
  routes.use('/:id/reject', ...reviewer);
  routes.use('/:id/takedown', ...reviewer);
  routes.use('/:id/pin-reply', ...reviewer);
  routes.use('/replies/:id/takedown', ...reviewer);

  const listRoute = createRoute({
    method: 'get',
    path: '/',
    tags: ['Discussions', 'Admin'],
    summary: 'Antrean ruang diskusi (filter status)',
    request: { query: listAdminDiscussionsQuerySchema },
    responses: {
      200: { description: 'Daftar', content: json(discussionAdminListResponseSchema) },
      401: { description: 'Token tidak ada/invalid', content: json(errorResponseSchema) },
      403: { description: 'Bukan verifikator', content: json(errorResponseSchema) },
    },
  });

  const detailRoute = createRoute({
    method: 'get',
    path: '/:id',
    tags: ['Discussions', 'Admin'],
    summary: 'Detail admin (termasuk URL ImageKit staging saat pending)',
    request: { params: discussionIdParamSchema },
    responses: {
      200: { description: 'Detail', content: json(discussionAdminDetailResponseSchema) },
      401: { description: 'Token tidak ada/invalid', content: json(errorResponseSchema) },
      403: { description: 'Bukan verifikator', content: json(errorResponseSchema) },
      404: { description: 'Tidak ditemukan', content: json(errorResponseSchema) },
    },
  });

  const approveRoute = createRoute({
    method: 'post',
    path: '/:id/approve',
    tags: ['Discussions', 'Admin'],
    summary:
      'Setujui & tayangkan: multipart file_0.. / file opsional (sensor), atau JSON tanpa file',
    request: {
      params: discussionIdParamSchema,
      body: {
        content: {
          'multipart/form-data': {
            schema: z.object({}).passthrough(),
          },
          'application/json': {
            schema: z.object({}).optional(),
          },
        },
      },
    },
    responses: {
      200: { description: 'Tayang', content: json(discussionAdminItemResponseSchema) },
      400: { description: 'File/gambar tidak valid', content: json(errorResponseSchema) },
      401: { description: 'Token tidak ada/invalid', content: json(errorResponseSchema) },
      403: { description: 'Bukan verifikator', content: json(errorResponseSchema) },
      404: { description: 'Tidak ditemukan / bukan pending', content: json(errorResponseSchema) },
    },
  });

  const rejectRoute = createRoute({
    method: 'post',
    path: '/:id/reject',
    tags: ['Discussions', 'Admin'],
    summary: 'Tolak (note wajib); hapus ImageKit',
    request: {
      params: discussionIdParamSchema,
      body: { content: json(rejectDiscussionBodySchema) },
    },
    responses: {
      200: { description: 'Ditolak', content: json(discussionAdminItemResponseSchema) },
      400: { description: 'Note wajib', content: json(errorResponseSchema) },
      401: { description: 'Token tidak ada/invalid', content: json(errorResponseSchema) },
      403: { description: 'Bukan verifikator', content: json(errorResponseSchema) },
      404: { description: 'Tidak ditemukan / bukan pending', content: json(errorResponseSchema) },
    },
  });

  const takedownRoute = createRoute({
    method: 'post',
    path: '/:id/takedown',
    tags: ['Discussions', 'Admin'],
    summary: 'Tarik dari feed setelah tayang',
    request: { params: discussionIdParamSchema },
    responses: {
      200: { description: 'Di-takedown', content: json(discussionAdminItemResponseSchema) },
      401: { description: 'Token tidak ada/invalid', content: json(errorResponseSchema) },
      403: { description: 'Bukan verifikator', content: json(errorResponseSchema) },
      404: { description: 'Tidak ditemukan / bukan published', content: json(errorResponseSchema) },
    },
  });

  const pinReplyRoute = createRoute({
    method: 'post',
    path: '/:id/pin-reply',
    tags: ['Discussions', 'Admin'],
    summary: 'Pin balasan terbaik',
    request: {
      params: discussionIdParamSchema,
      body: { content: json(pinDiscussionReplyBodySchema) },
    },
    responses: {
      200: { description: 'Pinned', content: json(discussionAdminItemResponseSchema) },
      400: { description: 'reply_id tidak valid', content: json(errorResponseSchema) },
      401: { description: 'Token tidak ada/invalid', content: json(errorResponseSchema) },
      403: { description: 'Bukan verifikator', content: json(errorResponseSchema) },
      404: { description: 'Help/reply tidak ditemukan', content: json(errorResponseSchema) },
    },
  });

  const takedownReplyRoute = createRoute({
    method: 'post',
    path: '/replies/:id/takedown',
    tags: ['Discussions', 'Admin'],
    summary: 'Takedown balasan',
    request: { params: discussionReplyIdParamSchema },
    responses: {
      200: {
        description: 'Balasan di-takedown',
        content: json(
          z.object({
            success: z.literal(true),
            data: discussionReplyPublicSchema.extend({
              body_original: z.string().nullable(),
              is_censored: z.boolean(),
              reviewed_by: z.string().nullable(),
              reviewed_at: z.string().nullable(),
            }),
          }),
        ),
      },
      401: { description: 'Token tidak ada/invalid', content: json(errorResponseSchema) },
      403: { description: 'Bukan verifikator', content: json(errorResponseSchema) },
      404: { description: 'Balasan tidak ditemukan', content: json(errorResponseSchema) },
    },
  });

  routes.openapi(listRoute, (c) => deps.controller.listAdmin(c, c.req.valid('query')) as never);
  routes.openapi(detailRoute, (c) =>
    deps.controller.getAdminDetail(c, c.req.valid('param').id) as never,
  );
  routes.openapi(approveRoute, (c) =>
    deps.controller.approve(c, c.req.valid('param').id) as never,
  );
  routes.openapi(rejectRoute, (c) =>
    deps.controller.reject(c, c.req.valid('param').id, c.req.valid('json')) as never,
  );
  routes.openapi(takedownRoute, (c) =>
    deps.controller.takedown(c, c.req.valid('param').id) as never,
  );
  routes.openapi(pinReplyRoute, (c) =>
    deps.controller.pinReply(c, c.req.valid('param').id, c.req.valid('json')) as never,
  );
  routes.openapi(takedownReplyRoute, (c) =>
    deps.controller.takedownReply(c, c.req.valid('param').id) as never,
  );

  return routes;
}
