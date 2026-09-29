import type { MiddlewareHandler } from 'hono';
import { bodyLimit } from 'hono/body-limit';
import { createRoute } from '@hono/zod-openapi';
import { z } from 'zod';
import { createOpenApiApp } from '@/shared/openapi/openapi-app';
import { errorResponseSchema } from '@/shared/openapi/error-response.schema';
import type { AppVariables } from '@/shared/types';
import { clientIpKey, rateLimit } from '@/shared/middlewares/rate-limit.middleware';
import type { DiscussionController } from './discussion.controller';
import {
  createDiscussionBodySchema,
  createDiscussionReplyBodySchema,
  createDiscussionReplyResponseSchema,
  createDiscussionResponseSchema,
  deleteDiscussionReplyResponseSchema,
  attachDiscussionAudioResponseSchema,
  listMyDiscussionsQuerySchema,
  listDiscussionsQuerySchema,
  discussionIdParamSchema,
  discussionOwnerDetailResponseSchema,
  discussionOwnerListResponseSchema,
  discussionPublicDetailResponseSchema,
  discussionPublicListResponseSchema,
  discussionReplyIdParamSchema,
  discussionUploadTokenQuerySchema,
  uploadCredentialsResponseSchema,
} from './validators/discussion.validator';

const json = <T extends z.ZodType>(schema: T) => ({
  'application/json': { schema },
});

export interface DiscussionRoutesDeps {
  controller: DiscussionController;
  authenticate: MiddlewareHandler<{ Variables: AppVariables }>;
  optionalAuthenticate: MiddlewareHandler<{ Variables: AppVariables }>;
  /** Gate azp + scope discussion.write pada tulis. */
  requireApprovedClient?: MiddlewareHandler<{ Variables: AppVariables }>;
  onUgcRateLimited?: (userId: string) => void | Promise<void>;
}

function ugcRateLimitedHook(
  onUgcRateLimited?: (userId: string) => void | Promise<void>,
) {
  return async (c: { get: (k: 'user') => { user_id: string } | undefined }) => {
    const uid = c.get('user')?.user_id;
    if (uid && onUgcRateLimited) await onUgcRateLimited(uid);
  };
}

const tokenUserLimit = rateLimit({
  points: 20,
  duration: 3600,
  keyFn: (c) => {
    const uid = (c as { get: (k: 'user') => { user_id: string } | undefined }).get('user')?.user_id;
    return uid ? `th-tok:user:${uid}` : '';
  },
});
const tokenIpLimit = rateLimit({
  points: 40,
  duration: 3600,
  keyFn: (c) => `th-tok:ip:${clientIpKey(c)}`,
});

function submitUserLimit(onUgcRateLimited?: (userId: string) => void | Promise<void>) {
  return rateLimit({
    points: 10,
    duration: 3600,
    keyFn: (c) => {
      const uid = (c as { get: (k: 'user') => { user_id: string } | undefined }).get('user')?.user_id;
      return uid ? `th-submit:user:${uid}` : '';
    },
    onLimited: ugcRateLimitedHook(onUgcRateLimited),
  });
}

function replyUserLimit(onUgcRateLimited?: (userId: string) => void | Promise<void>) {
  return rateLimit({
    points: 30,
    duration: 3600,
    keyFn: (c) => {
      const uid = (c as { get: (k: 'user') => { user_id: string } | undefined }).get('user')?.user_id;
      return uid ? `th-reply:user:${uid}` : '';
    },
    onLimited: ugcRateLimitedHook(onUgcRateLimited),
  });
}

function replyAudioUserLimit(onUgcRateLimited?: (userId: string) => void | Promise<void>) {
  return rateLimit({
    points: 30,
    duration: 60,
    keyFn: (c) => {
      const uid = (c as { get: (k: 'user') => { user_id: string } | undefined }).get('user')?.user_id;
      return uid ? `th-reply-audio:user:${uid}` : '';
    },
    onLimited: ugcRateLimitedHook(onUgcRateLimited),
  });
}

export function createDiscussionRoutes(deps: DiscussionRoutesDeps) {
  const routes = createOpenApiApp();
  const writeClient = deps.requireApprovedClient ? [deps.requireApprovedClient] : [];
  const submitLimit = submitUserLimit(deps.onUgcRateLimited);
  const replyLimit = replyUserLimit(deps.onUgcRateLimited);
  const replyAudioLimit = replyAudioUserLimit(deps.onUgcRateLimited);

  routes.use('/upload-token', deps.authenticate, ...writeClient, tokenUserLimit, tokenIpLimit);
  routes.use('/', async (c, next) => {
    if (c.req.method === 'POST') return deps.authenticate(c, next);
    return next();
  });
  routes.use('/', async (c, next) => {
    if (c.req.method !== 'POST') return next();
    if (deps.requireApprovedClient) return deps.requireApprovedClient(c, next);
    return next();
  });
  routes.use('/', async (c, next) => {
    if (c.req.method !== 'POST') return next();
    return submitLimit(c, next);
  });
  routes.use('/my', deps.authenticate);
  routes.use('/:id', deps.optionalAuthenticate);
  routes.use(
    '/:id/audio',
    deps.authenticate,
    ...writeClient,
    replyAudioLimit,
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
  routes.use(
    '/:id/replies/audio',
    deps.authenticate,
    ...writeClient,
    replyAudioLimit,
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
  routes.use('/:id/replies', deps.authenticate, ...writeClient, replyLimit);
  routes.use('/replies/:id', deps.authenticate, ...writeClient);

  const uploadTokenRoute = createRoute({
    method: 'get',
    path: '/upload-token',
    tags: ['Discussions'],
    summary: 'Kredensial direct-upload ImageKit, folder hanya /discussions (login)',
    request: { query: discussionUploadTokenQuerySchema },
    responses: {
      200: {
        description: 'Token + signature upload',
        content: json(uploadCredentialsResponseSchema),
      },
      400: { description: 'Folder bukan /discussions', content: json(errorResponseSchema) },
      401: { description: 'Token tidak ada/invalid', content: json(errorResponseSchema) },
      429: { description: 'Rate limit', content: json(errorResponseSchema) },
      503: {
        description: 'Provider gambar belum dikonfigurasi',
        content: json(errorResponseSchema),
      },
    },
  });

  const createRouteDef = createRoute({
    method: 'post',
    path: '/',
    tags: ['Discussions'],
    summary: 'Kirim permintaan ruang diskusi (wajib login)',
    request: { body: { content: json(createDiscussionBodySchema) } },
    responses: {
      200: { description: 'Tersimpan pending_review', content: json(createDiscussionResponseSchema) },
      400: { description: 'Body tidak valid', content: json(errorResponseSchema) },
      401: { description: 'Token tidak ada/invalid', content: json(errorResponseSchema) },
      429: { description: 'Rate limit', content: json(errorResponseSchema) },
    },
  });

  const listRoute = createRoute({
    method: 'get',
    path: '/',
    tags: ['Discussions'],
    summary: 'Feed ruang diskusi yang tayang (publik)',
    request: { query: listDiscussionsQuerySchema },
    responses: {
      200: { description: 'Daftar published', content: json(discussionPublicListResponseSchema) },
    },
  });

  const myRoute = createRoute({
    method: 'get',
    path: '/my',
    tags: ['Discussions'],
    summary: 'Riwayat diskusi saya',
    request: { query: listMyDiscussionsQuerySchema },
    responses: {
      200: { description: 'Daftar milik user', content: json(discussionOwnerListResponseSchema) },
      401: { description: 'Token tidak ada/invalid', content: json(errorResponseSchema) },
    },
  });

  const detailRoute = createRoute({
    method: 'get',
    path: '/:id',
    tags: ['Discussions'],
    summary: 'Detail diskusi (published publik; pending/rejected hanya pemilik)',
    request: { params: discussionIdParamSchema },
    responses: {
      200: {
        description: 'Detail',
        content: {
          'application/json': {
            schema: discussionPublicDetailResponseSchema.or(
              discussionOwnerDetailResponseSchema,
            ),
          },
        },
      },
      404: { description: 'Tidak ditemukan', content: json(errorResponseSchema) },
    },
  });

  const createReplyRoute = createRoute({
    method: 'post',
    path: '/:id/replies',
    tags: ['Discussions'],
    summary: 'Balas diskusi yang sudah tayang (login)',
    request: {
      params: discussionIdParamSchema,
      body: { content: json(createDiscussionReplyBodySchema) },
    },
    responses: {
      201: { description: 'Balasan tersimpan', content: json(createDiscussionReplyResponseSchema) },
      400: { description: 'Body tidak valid', content: json(errorResponseSchema) },
      401: { description: 'Token tidak ada/invalid', content: json(errorResponseSchema) },
      404: { description: 'Diskusi tidak ditemukan', content: json(errorResponseSchema) },
      409: { description: 'Diskusi belum tayang', content: json(errorResponseSchema) },
    },
  });

  const createReplyAudioRoute = createRoute({
    method: 'post',
    path: '/:id/replies/audio',
    tags: ['Discussions'],
    summary: 'Balas dengan rekaman suara (multipart; publish langsung)',
    request: {
      params: discussionIdParamSchema,
      body: {
        content: {
          'multipart/form-data': {
            schema: z.object({
              audio: z.any().openapi({ type: 'string', format: 'binary' }),
              body: z.string().max(500).optional(),
              duration_ms: z.coerce.number().int().optional(),
            }),
          },
        },
      },
    },
    responses: {
      201: { description: 'Balasan suara tersimpan', content: json(createDiscussionReplyResponseSchema) },
      400: { description: 'File/MIME tidak valid', content: json(errorResponseSchema) },
      401: { description: 'Token tidak ada/invalid', content: json(errorResponseSchema) },
      404: { description: 'Diskusi tidak ditemukan', content: json(errorResponseSchema) },
      409: { description: 'Diskusi belum tayang', content: json(errorResponseSchema) },
      429: { description: 'Rate limit', content: json(errorResponseSchema) },
      503: { description: 'Storage audio belum dikonfigurasi', content: json(errorResponseSchema) },
    },
  });

  const attachTopicAudioRoute = createRoute({
    method: 'post',
    path: '/:id/audio',
    tags: ['Discussions'],
    summary: 'Lampirkan audio ke opening thread pending_review (owner)',
    request: {
      params: discussionIdParamSchema,
      body: {
        content: {
          'multipart/form-data': {
            schema: z.object({
              audio: z.any().openapi({ type: 'string', format: 'binary' }),
              duration_ms: z.coerce.number().int().optional(),
            }),
          },
        },
      },
    },
    responses: {
      200: { description: 'Audio dilampirkan', content: json(attachDiscussionAudioResponseSchema) },
      400: { description: 'File/MIME tidak valid', content: json(errorResponseSchema) },
      401: { description: 'Token tidak ada/invalid', content: json(errorResponseSchema) },
      403: { description: 'Bukan pemilik', content: json(errorResponseSchema) },
      404: { description: 'Diskusi tidak ditemukan', content: json(errorResponseSchema) },
      409: { description: 'Bukan pending_review', content: json(errorResponseSchema) },
      429: { description: 'Rate limit', content: json(errorResponseSchema) },
      503: { description: 'Storage audio belum dikonfigurasi', content: json(errorResponseSchema) },
    },
  });

  const deleteReplyRoute = createRoute({
    method: 'delete',
    path: '/replies/:id',
    tags: ['Discussions'],
    summary: 'Hapus balasan sendiri',
    request: { params: discussionReplyIdParamSchema },
    responses: {
      200: { description: 'Dihapus', content: json(deleteDiscussionReplyResponseSchema) },
      401: { description: 'Token tidak ada/invalid', content: json(errorResponseSchema) },
      403: { description: 'Bukan penulis', content: json(errorResponseSchema) },
      404: { description: 'Balasan tidak ditemukan', content: json(errorResponseSchema) },
    },
  });

  routes.openapi(
    uploadTokenRoute,
    (c) => deps.controller.uploadCredentials(c, c.req.valid('query').folder) as never,
  );
  routes.openapi(createRouteDef, (c) =>
    deps.controller.create(c, c.req.valid('json')) as never,
  );
  routes.openapi(listRoute, (c) =>
    deps.controller.listPublished(c, c.req.valid('query')) as never,
  );
  routes.openapi(myRoute, (c) => deps.controller.listMine(c, c.req.valid('query')) as never);
  routes.openapi(detailRoute, (c) =>
    deps.controller.getDetail(c, c.req.valid('param').id) as never,
  );
  // Audio route sebelum /:id/replies agar path spesifik menang
  routes.openapi(attachTopicAudioRoute, (c) =>
    deps.controller.attachAudio(c, c.req.valid('param').id) as never,
  );
  routes.openapi(createReplyAudioRoute, (c) =>
    deps.controller.createReplyAudio(c, c.req.valid('param').id) as never,
  );
  routes.openapi(createReplyRoute, (c) =>
    deps.controller.createReply(c, c.req.valid('param').id, c.req.valid('json')) as never,
  );
  routes.openapi(deleteReplyRoute, (c) =>
    deps.controller.deleteReply(c, c.req.valid('param').id) as never,
  );

  return routes;
}
