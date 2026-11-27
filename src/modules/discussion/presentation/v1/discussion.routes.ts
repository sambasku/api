import type { MiddlewareHandler } from 'hono';
import { bodyLimit } from 'hono/body-limit';
import { createRoute } from '@hono/zod-openapi';
import { z } from 'zod';
import { authorizeRole } from '@/shared/middlewares/authorize-role.middleware';
import { createOpenApiApp } from '@/shared/openapi/openapi-app';
import { errorResponseSchema } from '@/shared/openapi/error-response.schema';
import type { AppVariables } from '@/shared/types';
import { clientIpKey, rateLimit } from '@/shared/middlewares/rate-limit.middleware';
import type { DiscussionController } from './discussion.controller';
import {
  createDiscussionBodySchema,
  createDiscussionLemmaLinkBodySchema,
  createDiscussionReplyBodySchema,
  createDiscussionReplyResponseSchema,
  createDiscussionResponseSchema,
  deleteDiscussionLemmaLinkResponseSchema,
  deleteDiscussionReplyResponseSchema,
  deleteDiscussionResponseSchema,
  discussionEditHistoryResponseSchema,
  discussionLemmaLinkIdParamSchema,
  discussionLemmaLinkResponseSchema,
  discussionReplyEditHistoryResponseSchema,
  updateDiscussionBodySchema,
  updateDiscussionReplyBodySchema,
  updateDiscussionReplyResponseSchema,
  updateDiscussionResponseSchema,
  attachDiscussionAudioResponseSchema,
  listDiscussionLemmaLinksResponseSchema,
  listMyDiscussionsQuerySchema,
  listDiscussionsQuerySchema,
  discussionIdParamSchema,
  discussionOwnerDetailResponseSchema,
  discussionOwnerListResponseSchema,
  discussionPublicDetailResponseSchema,
  discussionPublicListResponseSchema,
  discussionReplyIdParamSchema,
  discussionUploadTokenQuerySchema,
  proposeDiscussionLemmaCorrectionBodySchema,
  resolveDiscussionLemmaCorrectionBodySchema,
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
  /** Gate persetujuan legal untuk aksi tulis (403 CONSENT_REQUIRED). */
  requireLegalConsent?: MiddlewareHandler<{ Variables: AppVariables }>;
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
  const legalConsent = deps.requireLegalConsent ? [deps.requireLegalConsent] : [];
  const submitLimit = submitUserLimit(deps.onUgcRateLimited);
  const replyLimit = replyUserLimit(deps.onUgcRateLimited);
  const replyAudioLimit = replyAudioUserLimit(deps.onUgcRateLimited);

  routes.use('/upload-token', deps.authenticate, ...writeClient, ...legalConsent, tokenUserLimit, tokenIpLimit);
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
    if (deps.requireLegalConsent) return deps.requireLegalConsent(c, next);
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
    ...legalConsent,
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
    ...legalConsent,
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
  routes.use('/:id/replies', deps.authenticate, ...writeClient, ...legalConsent, replyLimit);

  routes.use(
    '/replies/:id/edit-history',
    rateLimit({ points: 100, duration: 60, keyFn: (c) => clientIpKey(c) }),
  );
  routes.use(
    '/:id/edit-history',
    rateLimit({ points: 100, duration: 60, keyFn: (c) => clientIpKey(c) }),
  );

  const replyWriteChain = [
    deps.authenticate,
    ...writeClient,
    ...legalConsent,
    replyLimit,
  ] as const;
  routes.on('delete', '/replies/:id', ...replyWriteChain);
  routes.on('patch', '/replies/:id', ...replyWriteChain);

  const topicWriteChain = [
    deps.authenticate,
    ...writeClient,
    ...legalConsent,
    submitLimit,
  ] as const;
  routes.on('delete', '/:id', ...topicWriteChain);
  routes.on('patch', '/:id', ...topicWriteChain);

  routes.use('/:id/lemma-links', async (c, next) => {
    if (c.req.method === 'GET') return deps.optionalAuthenticate(c, next);
    if (c.req.method !== 'POST') return next();
    return deps.authenticate(c, next);
  });
  routes.use('/:id/lemma-links', async (c, next) => {
    if (c.req.method !== 'POST') return next();
    if (deps.requireApprovedClient) return deps.requireApprovedClient(c, next);
    return next();
  });
  routes.use('/:id/lemma-links', async (c, next) => {
    if (c.req.method !== 'POST') return next();
    if (deps.requireLegalConsent) return deps.requireLegalConsent(c, next);
    return next();
  });
  routes.use('/:id/lemma-links', async (c, next) => {
    if (c.req.method !== 'POST') return next();
    return submitLimit(c, next);
  });
  routes.use('/:id/lemma-links/*', async (c, next) => {
    if (c.req.method !== 'POST') return next();
    return deps.authenticate(c, next);
  });
  routes.use('/:id/lemma-links/*', async (c, next) => {
    if (c.req.method !== 'POST') return next();
    if (deps.requireApprovedClient) return deps.requireApprovedClient(c, next);
    return next();
  });
  routes.use('/:id/lemma-links/*', async (c, next) => {
    if (c.req.method !== 'POST') return next();
    if (deps.requireLegalConsent) return deps.requireLegalConsent(c, next);
    return next();
  });
  routes.use('/:id/lemma-links/*', async (c, next) => {
    if (c.req.method !== 'POST') return next();
    return submitLimit(c, next);
  });
  routes.on('delete', '/:id/lemma-links/:linkId', ...topicWriteChain);

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
      200: { description: 'Tayang langsung (published)', content: json(createDiscussionResponseSchema) },
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
    summary: 'Lampirkan audio ke opening thread (owner, pending_review atau published)',
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
      409: { description: 'Status tidak mengizinkan lampir audio', content: json(errorResponseSchema) },
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

  const updateReplyRoute = createRoute({
    method: 'patch',
    path: '/replies/:id',
    tags: ['Discussions'],
    summary: 'Edit balasan sendiri (published; tanpa ganti audio)',
    request: {
      params: discussionReplyIdParamSchema,
      body: { content: json(updateDiscussionReplyBodySchema) },
    },
    responses: {
      200: { description: 'Balasan diperbarui', content: json(updateDiscussionReplyResponseSchema) },
      400: { description: 'Body tidak valid', content: json(errorResponseSchema) },
      401: { description: 'Token tidak ada/invalid', content: json(errorResponseSchema) },
      403: { description: 'Bukan penulis', content: json(errorResponseSchema) },
      404: { description: 'Balasan tidak ditemukan', content: json(errorResponseSchema) },
      429: { description: 'Rate limit', content: json(errorResponseSchema) },
    },
  });

  const updateDiscussionRoute = createRoute({
    method: 'patch',
    path: '/:id',
    tags: ['Discussions'],
    summary:
      'Edit OP sendiri (tetap published; body+link; gambar/audio tidak diganti)',
    request: {
      params: discussionIdParamSchema,
      body: { content: json(updateDiscussionBodySchema) },
    },
    responses: {
      200: {
        description: 'Disimpan & tetap tayang',
        content: json(updateDiscussionResponseSchema),
      },
      400: { description: 'Body tidak valid', content: json(errorResponseSchema) },
      401: { description: 'Token tidak ada/invalid', content: json(errorResponseSchema) },
      403: { description: 'Bukan penulis', content: json(errorResponseSchema) },
      404: { description: 'Diskusi tidak ditemukan', content: json(errorResponseSchema) },
      429: { description: 'Rate limit', content: json(errorResponseSchema) },
    },
  });

  const deleteDiscussionRoute = createRoute({
    method: 'delete',
    path: '/:id',
    tags: ['Discussions'],
    summary: 'Batalkan penayangan OP sendiri → deleted_by_author',
    request: { params: discussionIdParamSchema },
    responses: {
      200: { description: 'Dibatalkan', content: json(deleteDiscussionResponseSchema) },
      401: { description: 'Token tidak ada/invalid', content: json(errorResponseSchema) },
      403: { description: 'Bukan penulis', content: json(errorResponseSchema) },
      404: { description: 'Diskusi tidak ditemukan', content: json(errorResponseSchema) },
    },
  });

  const replyEditHistoryRoute = createRoute({
    method: 'get',
    path: '/replies/:id/edit-history',
    tags: ['Discussions'],
    summary: 'Riwayat sunting balasan (publik; hanya published)',
    request: { params: discussionReplyIdParamSchema },
    responses: {
      200: {
        description: 'Current + revisions (newest first)',
        content: json(discussionReplyEditHistoryResponseSchema),
      },
      404: { description: 'Balasan tidak ditemukan', content: json(errorResponseSchema) },
      429: { description: 'Rate limit', content: json(errorResponseSchema) },
    },
  });

  const discussionEditHistoryRoute = createRoute({
    method: 'get',
    path: '/:id/edit-history',
    tags: ['Discussions'],
    summary: 'Riwayat sunting OP (publik; hanya published)',
    request: { params: discussionIdParamSchema },
    responses: {
      200: {
        description: 'Current + revisions (newest first)',
        content: json(discussionEditHistoryResponseSchema),
      },
      404: { description: 'Diskusi tidak ditemukan', content: json(errorResponseSchema) },
      429: { description: 'Rate limit', content: json(errorResponseSchema) },
    },
  });

  const listLemmaLinksRoute = createRoute({
    method: 'get',
    path: '/{id}/lemma-links',
    tags: ['Discussions'],
    summary: 'List tautan lemma pada diskusi',
    request: { params: discussionIdParamSchema },
    responses: {
      200: {
        description: 'OK',
        content: json(listDiscussionLemmaLinksResponseSchema),
      },
      404: { description: 'Diskusi tidak ditemukan', content: json(errorResponseSchema) },
    },
  });

  const createLemmaLinkRoute = createRoute({
    method: 'post',
    path: '/{id}/lemma-links',
    tags: ['Discussions'],
    summary: 'Tambah span lemma (OP atau balasan)',
    request: {
      params: discussionIdParamSchema,
      body: { content: json(createDiscussionLemmaLinkBodySchema), required: true },
    },
    responses: {
      201: {
        description: 'Created',
        content: json(discussionLemmaLinkResponseSchema),
      },
      400: { description: 'Validasi gagal', content: json(errorResponseSchema) },
      401: { description: 'Unauthorized', content: json(errorResponseSchema) },
      404: { description: 'Diskusi/balasan tidak ditemukan', content: json(errorResponseSchema) },
    },
  });

  const proposeLemmaCorrectionRoute = createRoute({
    method: 'post',
    path: '/{id}/lemma-links/{linkId}/corrections',
    tags: ['Discussions'],
    summary: 'Usul koreksi lemma pada span',
    request: {
      params: discussionLemmaLinkIdParamSchema,
      body: {
        content: json(proposeDiscussionLemmaCorrectionBodySchema),
        required: true,
      },
    },
    responses: {
      200: {
        description: 'OK',
        content: json(discussionLemmaLinkResponseSchema),
      },
      400: { description: 'Validasi gagal', content: json(errorResponseSchema) },
      401: { description: 'Unauthorized', content: json(errorResponseSchema) },
      404: { description: 'Tautan tidak ditemukan', content: json(errorResponseSchema) },
      409: { description: 'Koreksi sudah pending', content: json(errorResponseSchema) },
    },
  });

  const resolveLemmaCorrectionRoute = createRoute({
    method: 'post',
    path: '/{id}/lemma-links/{linkId}/resolve',
    tags: ['Discussions'],
    summary: 'Approve/reject koreksi lemma (verifikator)',
    request: {
      params: discussionLemmaLinkIdParamSchema,
      body: {
        content: json(resolveDiscussionLemmaCorrectionBodySchema),
        required: true,
      },
    },
    responses: {
      200: {
        description: 'OK',
        content: json(discussionLemmaLinkResponseSchema),
      },
      400: { description: 'Validasi gagal', content: json(errorResponseSchema) },
      401: { description: 'Unauthorized', content: json(errorResponseSchema) },
      404: { description: 'Tautan tidak ditemukan', content: json(errorResponseSchema) },
    },
  });

  const deleteLemmaLinkRoute = createRoute({
    method: 'delete',
    path: '/{id}/lemma-links/{linkId}',
    tags: ['Discussions'],
    summary: 'Hapus tautan lemma (penulis OP / penulis balasan / staf)',
    request: { params: discussionLemmaLinkIdParamSchema },
    responses: {
      200: {
        description: 'OK',
        content: json(deleteDiscussionLemmaLinkResponseSchema),
      },
      401: { description: 'Unauthorized', content: json(errorResponseSchema) },
      403: { description: 'Bukan pemilik', content: json(errorResponseSchema) },
      404: { description: 'Tautan tidak ditemukan', content: json(errorResponseSchema) },
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
  routes.openapi(replyEditHistoryRoute, (c) =>
    deps.controller.replyEditHistory(c, c.req.valid('param').id) as never,
  );
  routes.openapi(discussionEditHistoryRoute, (c) =>
    deps.controller.editHistory(c, c.req.valid('param').id) as never,
  );
  routes.openapi(updateReplyRoute, (c) =>
    deps.controller.updateReply(c, c.req.valid('param').id, c.req.valid('json')) as never,
  );
  routes.openapi(deleteReplyRoute, (c) =>
    deps.controller.deleteReply(c, c.req.valid('param').id) as never,
  );
  routes.openapi(updateDiscussionRoute, (c) =>
    deps.controller.update(c, c.req.valid('param').id, c.req.valid('json')) as never,
  );
  routes.openapi(deleteDiscussionRoute, (c) =>
    deps.controller.delete(c, c.req.valid('param').id) as never,
  );
  routes.openapi(listLemmaLinksRoute, (c) =>
    deps.controller.listLemmaLinks(c, c.req.valid('param').id) as never,
  );
  routes.openapi(createLemmaLinkRoute, (c) =>
    deps.controller.createLemmaLink(
      c,
      c.req.valid('param').id,
      c.req.valid('json'),
    ) as never,
  );
  routes.openapi(proposeLemmaCorrectionRoute, (c) => {
    const p = c.req.valid('param');
    return deps.controller.proposeLemmaCorrection(
      c,
      p.id,
      p.linkId,
      c.req.valid('json'),
    ) as never;
  });
  routes.use(
    '/:id/lemma-links/:linkId/resolve',
    deps.authenticate,
    authorizeRole('root', 'admin', 'reviewer', 'editor', 'verifier'),
  );
  routes.openapi(resolveLemmaCorrectionRoute, (c) => {
    const p = c.req.valid('param');
    return deps.controller.resolveLemmaCorrection(
      c,
      p.id,
      p.linkId,
      c.req.valid('json'),
    ) as never;
  });
  routes.openapi(deleteLemmaLinkRoute, (c) => {
    const p = c.req.valid('param');
    return deps.controller.deleteLemmaLink(c, p.id, p.linkId) as never;
  });

  return routes;
}
