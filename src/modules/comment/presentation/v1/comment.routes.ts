import type { MiddlewareHandler } from 'hono';
import { bodyLimit } from 'hono/body-limit';
import { createRoute } from '@hono/zod-openapi';
import { z } from 'zod';
import { clientIpKey, rateLimit } from '@/shared/middlewares/rate-limit.middleware';
import { createOpenApiApp } from '@/shared/openapi/openapi-app';
import { errorResponseSchema, okNullResponseSchema } from '@/shared/openapi/error-response.schema';
import type { AppVariables, AuthUser } from '@/shared/types';
import type { CommentController } from './comment.controller';
import {
  attachCommentImageBodySchema,
  commentBodySchema,
  commentEditHistoryResponseSchema,
  commentUploadTokenQuerySchema,
  createCommentResponseSchema,
  listCommentsQuerySchema,
  listCommentsResponseSchema,
  listMyCommentsQuerySchema,
  myCommentsResponseSchema,
  updateCommentBodySchema,
  updateCommentResponseSchema,
  uploadCredentialsResponseSchema,
} from './validators/comment.validator';

const json = <T extends z.ZodType>(schema: T) => ({
  'application/json': { schema },
});

export interface CommentRoutesDeps {
  controller: CommentController;
  authenticate: MiddlewareHandler<{ Variables: AppVariables }>;
  /** Gate azp + scope comment.write pada tulis komentar. */
  requireApprovedClient?: MiddlewareHandler<{ Variables: AppVariables }>;
  /** Gate persetujuan legal untuk tulis komentar (403 CONSENT_REQUIRED). */
  requireLegalConsent?: MiddlewareHandler<{ Variables: AppVariables }>;
  /** Best-effort strike saat rate limit tulis UGC. */
  onUgcRateLimited?: (userId: string) => void | Promise<void>;
}

const ulid26 = z.string().length(26);

// GET + POST /api/v1/words/:wordId/comments (09-api-comment.md).
// MOUNT DI /api/v1/words SEBELUM createPublicWordRoutes (pola media
// routes) supaya tidak tertelan routes.use('*') rate limit public word.
export function createWordCommentRoutes(deps: CommentRoutesDeps) {
  const routes = createOpenApiApp();

  // List: baca publik - tier 100/menit per IP (Section 15)
  routes.use('/:wordId/comments', rateLimit({ points: 100, duration: 60 }));
  // Tulis: login (semua role) + azp gate + tier tulis 30/menit per user_id.
  // routes.on('post', ...) - BUKAN use() - supaya GET list tetap publik.
  routes.on(
    'post',
    '/:wordId/comments',
    deps.authenticate,
    ...(deps.requireApprovedClient ? [deps.requireApprovedClient] : []),
    ...(deps.requireLegalConsent ? [deps.requireLegalConsent] : []),
    wordCommentLimiter(deps.onUgcRateLimited),
  );
  routes.on(
    'post',
    '/:wordId/comments/audio',
    deps.authenticate,
    ...(deps.requireApprovedClient ? [deps.requireApprovedClient] : []),
    ...(deps.requireLegalConsent ? [deps.requireLegalConsent] : []),
    wordCommentLimiter(deps.onUgcRateLimited),
    bodyLimit({
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
    }),
  );

  const listRoute = createRoute({
    method: 'get',
    path: '/:wordId/comments',
    tags: ['Comments'],
    summary: 'Komentar pada sebuah kata (published/taken_down/deleted_by_author, + vote counts)',
    request: {
      params: z.object({ wordId: ulid26 }),
      query: listCommentsQuerySchema,
    },
    responses: {
      200: { description: 'Daftar komentar', content: json(listCommentsResponseSchema) },
      400: { description: 'Query tidak valid', content: json(errorResponseSchema) },
      429: { description: 'Terlalu banyak permintaan', content: json(errorResponseSchema) },
    },
  });

  const createCommentRoute = createRoute({
    method: 'post',
    path: '/:wordId/comments',
    tags: ['Comments'],
    summary: 'Tulis komentar pada lemma - langsung published (post-moderation + blocklist filter)',
    request: {
      params: z.object({ wordId: ulid26 }),
      body: { content: json(commentBodySchema) },
    },
    responses: {
      201: { description: 'Komentar tersimpan dan tayang', content: json(createCommentResponseSchema) },
      400: { description: 'Body kosong/kepanjangan', content: json(errorResponseSchema) },
      401: { description: 'Token tidak ada/invalid', content: json(errorResponseSchema) },
      404: { description: 'Kata tidak ditemukan', content: json(errorResponseSchema) },
      429: { description: 'Terlalu banyak komentar (30/menit per user)', content: json(errorResponseSchema) },
    },
  });

  const createCommentAudioRoute = createRoute({
    method: 'post',
    path: '/:wordId/comments/audio',
    tags: ['Comments'],
    summary: 'Komentar dengan rekaman suara (multipart; publish langsung)',
    request: {
      params: z.object({ wordId: ulid26 }),
      body: {
        content: {
          'multipart/form-data': {
            schema: z.object({
              audio: z.any().openapi({ type: 'string', format: 'binary' }),
              body: z.string().max(1000).optional(),
              duration_ms: z.coerce.number().int().optional(),
            }),
          },
        },
      },
    },
    responses: {
      201: { description: 'Komentar suara tersimpan', content: json(createCommentResponseSchema) },
      400: { description: 'File/MIME tidak valid', content: json(errorResponseSchema) },
      401: { description: 'Token tidak ada/invalid', content: json(errorResponseSchema) },
      404: { description: 'Kata tidak ditemukan', content: json(errorResponseSchema) },
      409: { description: 'Kata belum tayang', content: json(errorResponseSchema) },
      429: { description: 'Rate limit', content: json(errorResponseSchema) },
      503: { description: 'Storage audio belum dikonfigurasi', content: json(errorResponseSchema) },
    },
  });

  routes.openapi(listRoute, (c) =>
    deps.controller.listByWord(c, c.req.param('wordId'), c.req.valid('query')) as never,
  );
  // Audio sebelum POST JSON comments agar path spesifik menang
  routes.openapi(createCommentAudioRoute, (c) =>
    deps.controller.createAudio(c, c.req.param('wordId')) as never,
  );
  routes.openapi(createCommentRoute, (c) =>
    deps.controller.create(c, c.req.param('wordId'), c.req.valid('json')) as never,
  );

  return routes;
}

// DELETE /api/v1/comments/:id - penulis sendiri ATAU verifikator
// (otorisasi detail ada di use case, butuh data komentar).
export function createCommentRoutes(deps: CommentRoutesDeps) {
  const routes = createOpenApiApp();

  // /my SEBELUM /:id supaya "my" tidak tertelan param delete.
  routes.use(
    '/my',
    deps.authenticate,
    rateLimit({
      points: 100,
      duration: 60,
      keyFn: (c) => {
        const user = (c.get('user') as AuthUser | undefined) ?? null;
        return `my-comments:${user?.user_id ?? 'unknown'}`;
      },
    }),
  );

  const myRoute = createRoute({
    method: 'get',
    path: '/my',
    tags: ['Comments'],
    summary: 'Komentar milik user login (semua status kecuali soft-delete)',
    request: {
      query: listMyCommentsQuerySchema,
    },
    responses: {
      200: { description: 'Daftar komentar milik pemohon', content: json(myCommentsResponseSchema) },
      400: { description: 'Query tidak valid', content: json(errorResponseSchema) },
      401: { description: 'Token tidak ada/invalid', content: json(errorResponseSchema) },
      429: { description: 'Terlalu banyak permintaan (100/menit per user)', content: json(errorResponseSchema) },
    },
  });

  routes.openapi(myRoute, (c) => deps.controller.my(c, c.req.valid('query')) as never);

  const tokenUserLimit = rateLimit({
    points: 30,
    duration: 60,
    keyFn: (c) => {
      const user = (c.get('user') as AuthUser | undefined) ?? null;
      return `comment-upload-token:${user?.user_id ?? 'unknown'}`;
    },
  });
  routes.use(
    '/upload-token',
    deps.authenticate,
    ...(deps.requireApprovedClient ? [deps.requireApprovedClient] : []),
    ...(deps.requireLegalConsent ? [deps.requireLegalConsent] : []),
    tokenUserLimit,
  );

  const uploadTokenRoute = createRoute({
    method: 'get',
    path: '/upload-token',
    tags: ['Comments'],
    summary: 'Kredensial direct-upload ImageKit, folder hanya /comments (login)',
    request: { query: commentUploadTokenQuerySchema },
    responses: {
      200: {
        description: 'Token + signature upload',
        content: json(uploadCredentialsResponseSchema),
      },
      400: { description: 'Folder bukan /comments', content: json(errorResponseSchema) },
      401: { description: 'Token tidak ada/invalid', content: json(errorResponseSchema) },
      429: { description: 'Rate limit', content: json(errorResponseSchema) },
    },
  });

  routes.openapi(uploadTokenRoute, (c) =>
    deps.controller.uploadCredentials(c, c.req.valid('query').folder) as never,
  );

  routes.use(
    '/:id/edit-history',
    rateLimit({ points: 100, duration: 60, keyFn: (c) => clientIpKey(c) }),
  );

  const editHistoryRoute = createRoute({
    method: 'get',
    path: '/:id/edit-history',
    tags: ['Comments'],
    summary: 'Riwayat sunting komentar (publik; hanya published)',
    request: {
      params: z.object({ id: ulid26 }),
    },
    responses: {
      200: {
        description: 'Current + revisions (newest first)',
        content: json(commentEditHistoryResponseSchema),
      },
      404: { description: 'Komentar tidak ditemukan', content: json(errorResponseSchema) },
      429: { description: 'Terlalu banyak permintaan', content: json(errorResponseSchema) },
    },
  });

  routes.openapi(editHistoryRoute, (c) =>
    deps.controller.editHistory(c, c.req.param('id')) as never,
  );

  routes.on(
    'post',
    '/:id/image',
    deps.authenticate,
    ...(deps.requireApprovedClient ? [deps.requireApprovedClient] : []),
    ...(deps.requireLegalConsent ? [deps.requireLegalConsent] : []),
    wordCommentLimiter(deps.onUgcRateLimited),
  );

  routes.use(
    '/:id',
    deps.authenticate,
    ...(deps.requireApprovedClient ? [deps.requireApprovedClient] : []),
    ...(deps.requireLegalConsent ? [deps.requireLegalConsent] : []),
    wordCommentLimiter(deps.onUgcRateLimited),
  );

  const attachImageRoute = createRoute({
    method: 'post',
    path: '/:id/image',
    tags: ['Comments'],
    summary: 'Lampirkan foto staging ke komentar tayang (foto antre pending_review)',
    request: {
      params: z.object({ id: ulid26 }),
      body: { content: json(attachCommentImageBodySchema) },
    },
    responses: {
      201: { description: 'Foto dilampirkan, menunggu cek', content: json(createCommentResponseSchema) },
      400: { description: 'Body tidak valid', content: json(errorResponseSchema) },
      401: { description: 'Token tidak ada/invalid', content: json(errorResponseSchema) },
      403: { description: 'Bukan penulis', content: json(errorResponseSchema) },
      404: { description: 'Komentar tidak ditemukan', content: json(errorResponseSchema) },
      409: { description: 'Sudah ada foto / bukan published', content: json(errorResponseSchema) },
      429: { description: 'Rate limit', content: json(errorResponseSchema) },
    },
  });

  const updateRoute = createRoute({
    method: 'patch',
    path: '/:id',
    tags: ['Comments'],
    summary: 'Edit komentar oleh penulis (published; tanpa ganti audio)',
    request: {
      params: z.object({ id: ulid26 }),
      body: { content: json(updateCommentBodySchema) },
    },
    responses: {
      200: { description: 'Komentar diperbarui', content: json(updateCommentResponseSchema) },
      400: { description: 'Body tidak valid', content: json(errorResponseSchema) },
      401: { description: 'Token tidak ada/invalid', content: json(errorResponseSchema) },
      403: { description: 'Bukan penulis', content: json(errorResponseSchema) },
      404: { description: 'Komentar tidak ditemukan', content: json(errorResponseSchema) },
      409: { description: 'Kata belum tayang', content: json(errorResponseSchema) },
      429: { description: 'Rate limit', content: json(errorResponseSchema) },
    },
  });

  const deleteRoute = createRoute({
    method: 'delete',
    path: '/:id',
    tags: ['Comments'],
    summary: 'Hapus komentar oleh penulis → status deleted_by_author',
    request: {
      params: z.object({ id: ulid26 }),
    },
    responses: {
      200: { description: 'Komentar ditandai dihapus penulis', content: json(okNullResponseSchema) },
      401: { description: 'Token tidak ada/invalid', content: json(errorResponseSchema) },
      403: { description: 'Bukan penulis', content: json(errorResponseSchema) },
      404: { description: 'Komentar tidak ditemukan', content: json(errorResponseSchema) },
    },
  });

  routes.openapi(attachImageRoute, (c) =>
    deps.controller.attachImage(c, c.req.param('id'), c.req.valid('json')) as never,
  );
  routes.openapi(updateRoute, (c) =>
    deps.controller.update(c, c.req.param('id'), c.req.valid('json')) as never,
  );
  routes.openapi(deleteRoute, (c) => deps.controller.delete(c, c.req.param('id')) as never);

  return routes;
}

function wordCommentLimiter(onUgcRateLimited?: (userId: string) => void | Promise<void>) {
  return rateLimit({
    points: 30,
    duration: 60,
    keyFn: (c) => {
      const user = (c.get('user') as AuthUser | undefined) ?? null;
      return `comment-write:${user?.user_id ?? 'unknown'}`;
    },
    onLimited: async (c) => {
      const user = (c.get('user') as AuthUser | undefined) ?? null;
      if (user?.user_id && onUgcRateLimited) {
        await onUgcRateLimited(user.user_id);
      }
    },
  });
}
