import type { MiddlewareHandler } from 'hono';
import { createRoute } from '@hono/zod-openapi';
import { z } from 'zod';
import { authorizeRole } from '@/shared/middlewares/authorize-role.middleware';
import { rateLimit } from '@/shared/middlewares/rate-limit.middleware';
import { createOpenApiApp } from '@/shared/openapi/openapi-app';
import { errorResponseSchema } from '@/shared/openapi/error-response.schema';
import type { AppVariables } from '@/shared/types';
import type { JinyeController } from './jinye.controller';
import {
  createJinyeBodySchema,
  createJinyeCommentBodySchema,
  createJinyeCommentResponseSchema,
  createJinyeResponseSchema,
  createJinyeLemmaLinkBodySchema,
  createJinyeTranslationBodySchema,
  deleteJinyeCommentResponseSchema,
  deleteJinyeResponseSchema,
  jinyeCommentIdParamSchema,
  jinyeDetailResponseSchema,
  jinyeIdParamSchema,
  jinyeLemmaLinkIdParamSchema,
  jinyeLemmaLinkResponseSchema,
  jinyeTranslationIdParamSchema,
  jinyeTranslationResponseSchema,
  jinyeUploadTokenQuerySchema,
  listJinyeCommentsResponseSchema,
  listJinyeLemmaLinksResponseSchema,
  listJinyeQuerySchema,
  listJinyeResponseSchema,
  listJinyeTranslationsResponseSchema,
  promoteJinyeExampleBodySchema,
  promoteJinyeExampleResponseSchema,
  proposeJinyeLemmaCorrectionBodySchema,
  quoteJinyeBodySchema,
  resolveJinyeLemmaCorrectionBodySchema,
  resolveJinyeTranslationBodySchema,
  updateJinyeBodySchema,
  jinyeEditHistoryResponseSchema,
  uploadCredentialsResponseSchema,
} from './validators/jinye.validator';

const json = <T extends z.ZodType>(schema: T) => ({
  'application/json': { schema },
});

export interface JinyeRoutesDeps {
  controller: JinyeController;
  authenticate: MiddlewareHandler<{ Variables: AppVariables }>;
  optionalAuth?: MiddlewareHandler<{ Variables: AppVariables }>;
  requireApprovedClient?: MiddlewareHandler<{ Variables: AppVariables }>;
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

const createRouteDef = createRoute({
  method: 'post',
  path: '/',
  tags: ['Jinye'],
  summary: 'Buat Jinye',
  request: {
    body: { content: json(createJinyeBodySchema), required: true },
  },
  responses: {
    201: { description: 'Created', content: json(createJinyeResponseSchema) },
    400: { description: 'Validation', content: json(errorResponseSchema) },
    401: { description: 'Unauthorized', content: json(errorResponseSchema) },
    429: { description: 'Kuota 1 jam', content: json(errorResponseSchema) },
  },
});

const listRouteDef = createRoute({
  method: 'get',
  path: '/',
  tags: ['Jinye'],
  summary: 'List Jinye published',
  request: { query: listJinyeQuerySchema },
  responses: {
    200: { description: 'OK', content: json(listJinyeResponseSchema) },
  },
});

const uploadTokenRoute = createRoute({
  method: 'get',
  path: '/upload-token',
  tags: ['Jinye'],
  summary: 'Kredensial direct-upload ImageKit, folder hanya /jinye (login)',
  request: { query: jinyeUploadTokenQuerySchema },
  responses: {
    200: {
      description: 'Token + signature upload',
      content: json(uploadCredentialsResponseSchema),
    },
    400: { description: 'Folder bukan /jinye', content: json(errorResponseSchema) },
    401: { description: 'Unauthorized', content: json(errorResponseSchema) },
    429: { description: 'Rate limit', content: json(errorResponseSchema) },
    503: {
      description: 'Provider gambar belum dikonfigurasi',
      content: json(errorResponseSchema),
    },
  },
});

const detailRouteDef = createRoute({
  method: 'get',
  path: '/{id}',
  tags: ['Jinye'],
  summary: 'Detail Jinye',
  request: { params: jinyeIdParamSchema },
  responses: {
    200: { description: 'OK', content: json(jinyeDetailResponseSchema) },
    404: { description: 'Not found', content: json(errorResponseSchema) },
  },
});

const deleteRouteDef = createRoute({
  method: 'delete',
  path: '/{id}',
  tags: ['Jinye'],
  summary: 'Hapus Jinye sendiri',
  request: { params: jinyeIdParamSchema },
  responses: {
    200: { description: 'OK', content: json(deleteJinyeResponseSchema) },
    404: { description: 'Not found', content: json(errorResponseSchema) },
  },
});

const attachAudioRoute = createRoute({
  method: 'post',
  path: '/{id}/audio',
  tags: ['Jinye'],
  summary: 'Lampirkan / ganti voice note OP (owner)',
  request: {
    params: jinyeIdParamSchema,
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
    200: { description: 'Audio dilampirkan', content: json(jinyeDetailResponseSchema) },
    400: { description: 'File/MIME tidak valid', content: json(errorResponseSchema) },
    401: { description: 'Unauthorized', content: json(errorResponseSchema) },
    403: { description: 'Bukan pemilik', content: json(errorResponseSchema) },
    404: { description: 'Tidak ditemukan', content: json(errorResponseSchema) },
    409: { description: 'Status tidak editable', content: json(errorResponseSchema) },
    429: { description: 'Rate limit', content: json(errorResponseSchema) },
    503: { description: 'Storage audio belum dikonfigurasi', content: json(errorResponseSchema) },
  },
});

const listCommentsRoute = createRoute({
  method: 'get',
  path: '/{id}/comments',
  tags: ['Jinye'],
  summary: 'List komen + reply 1 level',
  request: { params: jinyeIdParamSchema },
  responses: {
    200: { description: 'OK', content: json(listJinyeCommentsResponseSchema) },
    404: { description: 'Tidak ditemukan', content: json(errorResponseSchema) },
  },
});

const createCommentRoute = createRoute({
  method: 'post',
  path: '/{id}/comments',
  tags: ['Jinye'],
  summary: 'Buat komen atau reply (parent_id opsional)',
  request: {
    params: jinyeIdParamSchema,
    body: { content: json(createJinyeCommentBodySchema), required: true },
  },
  responses: {
    201: { description: 'Created', content: json(createJinyeCommentResponseSchema) },
    400: { description: 'Validation', content: json(errorResponseSchema) },
    401: { description: 'Unauthorized', content: json(errorResponseSchema) },
    404: { description: 'Tidak ditemukan', content: json(errorResponseSchema) },
    429: { description: 'Rate limit', content: json(errorResponseSchema) },
  },
});

const deleteCommentRoute = createRoute({
  method: 'delete',
  path: '/{id}/comments/{commentId}',
  tags: ['Jinye'],
  summary: 'Hapus komen sendiri',
  request: { params: jinyeCommentIdParamSchema },
  responses: {
    200: { description: 'OK', content: json(deleteJinyeCommentResponseSchema) },
    403: { description: 'Bukan penulis', content: json(errorResponseSchema) },
    404: { description: 'Tidak ditemukan', content: json(errorResponseSchema) },
  },
});

const listArchivedRoute = createRoute({
  method: 'get',
  path: '/archived',
  tags: ['Jinye'],
  summary: 'List Jinye arsip milik sendiri',
  request: { query: listJinyeQuerySchema },
  responses: {
    200: { description: 'OK', content: json(listJinyeResponseSchema) },
    401: { description: 'Unauthorized', content: json(errorResponseSchema) },
  },
});

const archiveRoute = createRoute({
  method: 'post',
  path: '/{id}/archive',
  tags: ['Jinye'],
  summary: 'Arsipkan Jinye (owner)',
  request: { params: jinyeIdParamSchema },
  responses: {
    200: { description: 'OK', content: json(jinyeDetailResponseSchema) },
    401: { description: 'Unauthorized', content: json(errorResponseSchema) },
    404: { description: 'Tidak ditemukan', content: json(errorResponseSchema) },
  },
});

const unarchiveRoute = createRoute({
  method: 'post',
  path: '/{id}/unarchive',
  tags: ['Jinye'],
  summary: 'Pulihkan Jinye dari arsip (owner)',
  request: { params: jinyeIdParamSchema },
  responses: {
    200: { description: 'OK', content: json(jinyeDetailResponseSchema) },
    401: { description: 'Unauthorized', content: json(errorResponseSchema) },
    404: { description: 'Tidak ditemukan', content: json(errorResponseSchema) },
  },
});

const pinRoute = createRoute({
  method: 'post',
  path: '/{id}/pin',
  tags: ['Jinye'],
  summary: 'Pin Jinye ke profil (max 1; lepas pin lama)',
  request: { params: jinyeIdParamSchema },
  responses: {
    200: { description: 'OK', content: json(jinyeDetailResponseSchema) },
    400: { description: 'Bukan published', content: json(errorResponseSchema) },
    401: { description: 'Unauthorized', content: json(errorResponseSchema) },
    404: { description: 'Tidak ditemukan', content: json(errorResponseSchema) },
  },
});

const unpinRoute = createRoute({
  method: 'delete',
  path: '/{id}/pin',
  tags: ['Jinye'],
  summary: 'Unpin Jinye dari profil',
  request: { params: jinyeIdParamSchema },
  responses: {
    200: { description: 'OK', content: json(deleteJinyeResponseSchema) },
    401: { description: 'Unauthorized', content: json(errorResponseSchema) },
    404: { description: 'Tidak ditemukan', content: json(errorResponseSchema) },
  },
});

const listLemmaLinksRoute = createRoute({
  method: 'get',
  path: '/{id}/lemma-links',
  tags: ['Jinye'],
  summary: 'List tautan lemma pada Jinye',
  request: { params: jinyeIdParamSchema },
  responses: {
    200: { description: 'OK', content: json(listJinyeLemmaLinksResponseSchema) },
    404: { description: 'Tidak ditemukan', content: json(errorResponseSchema) },
  },
});

const createLemmaLinkRoute = createRoute({
  method: 'post',
  path: '/{id}/lemma-links',
  tags: ['Jinye'],
  summary: 'Tambah span lemma (penulis Jinye)',
  request: {
    params: jinyeIdParamSchema,
    body: { content: json(createJinyeLemmaLinkBodySchema), required: true },
  },
  responses: {
    201: { description: 'Created', content: json(jinyeLemmaLinkResponseSchema) },
    400: { description: 'Validation', content: json(errorResponseSchema) },
    401: { description: 'Unauthorized', content: json(errorResponseSchema) },
    403: { description: 'Bukan pemilik', content: json(errorResponseSchema) },
    404: { description: 'Tidak ditemukan', content: json(errorResponseSchema) },
  },
});

const proposeLemmaCorrectionRoute = createRoute({
  method: 'post',
  path: '/{id}/lemma-links/{linkId}/corrections',
  tags: ['Jinye'],
  summary: 'Usul koreksi lemma pada span',
  request: {
    params: jinyeLemmaLinkIdParamSchema,
    body: {
      content: json(proposeJinyeLemmaCorrectionBodySchema),
      required: true,
    },
  },
  responses: {
    200: { description: 'OK', content: json(jinyeLemmaLinkResponseSchema) },
    400: { description: 'Validation', content: json(errorResponseSchema) },
    401: { description: 'Unauthorized', content: json(errorResponseSchema) },
    404: { description: 'Tidak ditemukan', content: json(errorResponseSchema) },
    409: { description: 'Koreksi masih pending', content: json(errorResponseSchema) },
  },
});

const resolveLemmaCorrectionRoute = createRoute({
  method: 'post',
  path: '/{id}/lemma-links/{linkId}/resolve',
  tags: ['Jinye'],
  summary: 'Approve/reject koreksi lemma (verifikator)',
  request: {
    params: jinyeLemmaLinkIdParamSchema,
    body: {
      content: json(resolveJinyeLemmaCorrectionBodySchema),
      required: true,
    },
  },
  responses: {
    200: { description: 'OK', content: json(jinyeLemmaLinkResponseSchema) },
    400: { description: 'Validation', content: json(errorResponseSchema) },
    401: { description: 'Unauthorized', content: json(errorResponseSchema) },
    403: { description: 'Forbidden', content: json(errorResponseSchema) },
    404: { description: 'Tidak ditemukan', content: json(errorResponseSchema) },
  },
});

const deleteLemmaLinkRoute = createRoute({
  method: 'delete',
  path: '/{id}/lemma-links/{linkId}',
  tags: ['Jinye'],
  summary: 'Hapus tautan lemma (penulis / staf)',
  request: { params: jinyeLemmaLinkIdParamSchema },
  responses: {
    200: { description: 'OK', content: json(deleteJinyeResponseSchema) },
    401: { description: 'Unauthorized', content: json(errorResponseSchema) },
    403: { description: 'Forbidden', content: json(errorResponseSchema) },
    404: { description: 'Tidak ditemukan', content: json(errorResponseSchema) },
  },
});

const promoteExampleRoute = createRoute({
  method: 'post',
  path: '/{id}/promote-example',
  tags: ['Jinye'],
  summary: 'Usul Jinye jadi contoh lemma (± audio)',
  request: {
    params: jinyeIdParamSchema,
    body: { content: json(promoteJinyeExampleBodySchema), required: true },
  },
  responses: {
    201: {
      description: 'Created',
      content: json(promoteJinyeExampleResponseSchema),
    },
    400: { description: 'Validation', content: json(errorResponseSchema) },
    401: { description: 'Unauthorized', content: json(errorResponseSchema) },
    403: { description: 'Forbidden', content: json(errorResponseSchema) },
    404: { description: 'Tidak ditemukan', content: json(errorResponseSchema) },
  },
});

const listTranslationsRoute = createRoute({
  method: 'get',
  path: '/{id}/translations',
  tags: ['Jinye'],
  summary: 'List usulan terjemahan Jinye',
  request: { params: jinyeIdParamSchema },
  responses: {
    200: {
      description: 'OK',
      content: json(listJinyeTranslationsResponseSchema),
    },
    404: { description: 'Tidak ditemukan', content: json(errorResponseSchema) },
  },
});

const createTranslationRoute = createRoute({
  method: 'post',
  path: '/{id}/translations',
  tags: ['Jinye'],
  summary: 'Usul terjemahan Indonesia untuk Jinye',
  request: {
    params: jinyeIdParamSchema,
    body: { content: json(createJinyeTranslationBodySchema), required: true },
  },
  responses: {
    201: {
      description: 'Created',
      content: json(jinyeTranslationResponseSchema),
    },
    400: { description: 'Validation', content: json(errorResponseSchema) },
    401: { description: 'Unauthorized', content: json(errorResponseSchema) },
    409: { description: 'Conflict', content: json(errorResponseSchema) },
    404: { description: 'Tidak ditemukan', content: json(errorResponseSchema) },
  },
});

const resolveTranslationRoute = createRoute({
  method: 'post',
  path: '/{id}/translations/{translationId}/resolve',
  tags: ['Jinye'],
  summary: 'Approve/reject terjemahan Jinye (verifikator)',
  request: {
    params: jinyeTranslationIdParamSchema,
    body: {
      content: json(resolveJinyeTranslationBodySchema),
      required: true,
    },
  },
  responses: {
    200: { description: 'OK', content: json(jinyeTranslationResponseSchema) },
    400: { description: 'Validation', content: json(errorResponseSchema) },
    401: { description: 'Unauthorized', content: json(errorResponseSchema) },
    403: { description: 'Forbidden', content: json(errorResponseSchema) },
    404: { description: 'Tidak ditemukan', content: json(errorResponseSchema) },
  },
});

const updateJinyeRoute = createRoute({
  method: 'patch',
  path: '/{id}',
  tags: ['Jinye'],
  summary: 'Edit body Jinye (owner; tulis revisi)',
  request: {
    params: jinyeIdParamSchema,
    body: { content: json(updateJinyeBodySchema), required: true },
  },
  responses: {
    200: { description: 'OK', content: json(createJinyeResponseSchema) },
    400: { description: 'Validation', content: json(errorResponseSchema) },
    401: { description: 'Unauthorized', content: json(errorResponseSchema) },
    403: { description: 'Forbidden', content: json(errorResponseSchema) },
    404: { description: 'Tidak ditemukan', content: json(errorResponseSchema) },
  },
});

const editHistoryRoute = createRoute({
  method: 'get',
  path: '/{id}/edit-history',
  tags: ['Jinye'],
  summary: 'Riwayat sunting Jinye (publik; hanya published)',
  request: { params: jinyeIdParamSchema },
  responses: {
    200: {
      description: 'Current + revisions (newest first)',
      content: json(jinyeEditHistoryResponseSchema),
    },
    404: { description: 'Tidak ditemukan', content: json(errorResponseSchema) },
  },
});

const repostRoute = createRoute({
  method: 'post',
  path: '/{id}/repost',
  tags: ['Jinye'],
  summary: 'Repost polos (tidak makan kuota; depth 1)',
  request: { params: jinyeIdParamSchema },
  responses: {
    201: { description: 'Created', content: json(createJinyeResponseSchema) },
    401: { description: 'Unauthorized', content: json(errorResponseSchema) },
    403: { description: 'Forbidden', content: json(errorResponseSchema) },
    404: { description: 'Tidak ditemukan', content: json(errorResponseSchema) },
    409: { description: 'Sudah merepost', content: json(errorResponseSchema) },
  },
});

const unrepostRoute = createRoute({
  method: 'delete',
  path: '/{id}/repost',
  tags: ['Jinye'],
  summary: 'Batalkan repost polos',
  request: { params: jinyeIdParamSchema },
  responses: {
    200: { description: 'OK', content: json(deleteJinyeResponseSchema) },
    401: { description: 'Unauthorized', content: json(errorResponseSchema) },
    404: { description: 'Tidak ditemukan', content: json(errorResponseSchema) },
  },
});

const quoteRoute = createRoute({
  method: 'post',
  path: '/{id}/quote',
  tags: ['Jinye'],
  summary: 'Quote-repost (makan kuota create 1/jam)',
  request: {
    params: jinyeIdParamSchema,
    body: { content: json(quoteJinyeBodySchema), required: true },
  },
  responses: {
    201: { description: 'Created', content: json(createJinyeResponseSchema) },
    400: { description: 'Validation', content: json(errorResponseSchema) },
    401: { description: 'Unauthorized', content: json(errorResponseSchema) },
    404: { description: 'Tidak ditemukan', content: json(errorResponseSchema) },
    429: { description: 'Kuota 1 jam', content: json(errorResponseSchema) },
  },
});

export function createJinyeRoutes(deps: JinyeRoutesDeps) {
  const routes = createOpenApiApp();
  const writeLimit = rateLimit({
    points: 30,
    duration: 3600,
    keyFn: (c) => {
      const uid = (
        c as { get: (k: 'user') => { user_id: string } | undefined }
      ).get('user')?.user_id;
      return uid ? `jinye:user:${uid}` : '';
    },
    onLimited: ugcRateLimitedHook(deps.onUgcRateLimited),
  });
  const tokenUserLimit = rateLimit({
    points: 60,
    duration: 3600,
    keyFn: (c) => {
      const uid = (
        c as { get: (k: 'user') => { user_id: string } | undefined }
      ).get('user')?.user_id;
      return uid ? `jinye-upload-token:${uid}` : '';
    },
  });

  const writeClient = deps.requireApprovedClient
    ? [deps.requireApprovedClient]
    : [];
  const legalConsent = deps.requireLegalConsent
    ? [deps.requireLegalConsent]
    : [];

  routes.use('/upload-token', deps.authenticate, ...writeClient, ...legalConsent, tokenUserLimit);

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
    return writeLimit(c, next);
  });

  const isWriteOnId = (method: string) =>
    method === 'DELETE' || method === 'POST';

  routes.use('/:id', async (c, next) => {
    if (c.req.method === 'GET' && deps.optionalAuth) {
      return deps.optionalAuth(c, next);
    }
    if (!isWriteOnId(c.req.method)) return next();
    return deps.authenticate(c, next);
  });
  routes.use('/:id', async (c, next) => {
    if (!isWriteOnId(c.req.method)) return next();
    if (deps.requireApprovedClient) return deps.requireApprovedClient(c, next);
    return next();
  });
  routes.use('/:id', async (c, next) => {
    if (!isWriteOnId(c.req.method)) return next();
    if (deps.requireLegalConsent) return deps.requireLegalConsent(c, next);
    return next();
  });
  routes.use('/:id', async (c, next) => {
    if (!isWriteOnId(c.req.method)) return next();
    return writeLimit(c, next);
  });

  // Nested /:id/comments* - Hono tidak selalu warisi middleware /:id.
  routes.use('/:id/comments', async (c, next) => {
    if (c.req.method === 'GET' && deps.optionalAuth) {
      return deps.optionalAuth(c, next);
    }
    if (c.req.method !== 'POST') return next();
    return deps.authenticate(c, next);
  });
  routes.use('/:id/comments', async (c, next) => {
    if (c.req.method !== 'POST') return next();
    if (deps.requireApprovedClient) return deps.requireApprovedClient(c, next);
    return next();
  });
  routes.use('/:id/comments', async (c, next) => {
    if (c.req.method !== 'POST') return next();
    if (deps.requireLegalConsent) return deps.requireLegalConsent(c, next);
    return next();
  });
  routes.use('/:id/comments', async (c, next) => {
    if (c.req.method !== 'POST') return next();
    return writeLimit(c, next);
  });
  routes.use('/:id/comments/*', async (c, next) => {
    if (c.req.method !== 'DELETE') return next();
    return deps.authenticate(c, next);
  });
  routes.use('/:id/comments/*', async (c, next) => {
    if (c.req.method !== 'DELETE') return next();
    if (deps.requireApprovedClient) return deps.requireApprovedClient(c, next);
    return next();
  });
  routes.use('/:id/comments/*', async (c, next) => {
    if (c.req.method !== 'DELETE') return next();
    if (deps.requireLegalConsent) return deps.requireLegalConsent(c, next);
    return next();
  });
  routes.use('/:id/comments/*', async (c, next) => {
    if (c.req.method !== 'DELETE') return next();
    return writeLimit(c, next);
  });
  routes.use('/:id/audio', async (c, next) => {
    if (c.req.method !== 'POST') return next();
    return deps.authenticate(c, next);
  });
  routes.use('/:id/audio', async (c, next) => {
    if (c.req.method !== 'POST') return next();
    if (deps.requireApprovedClient) return deps.requireApprovedClient(c, next);
    return next();
  });
  routes.use('/:id/audio', async (c, next) => {
    if (c.req.method !== 'POST') return next();
    if (deps.requireLegalConsent) return deps.requireLegalConsent(c, next);
    return next();
  });
  routes.use('/:id/audio', async (c, next) => {
    if (c.req.method !== 'POST') return next();
    return writeLimit(c, next);
  });

  for (const sub of ['/:id/archive', '/:id/unarchive', '/:id/pin'] as const) {
    routes.use(sub, async (c, next) => {
      if (c.req.method !== 'POST' && c.req.method !== 'DELETE') return next();
      return deps.authenticate(c, next);
    });
    routes.use(sub, async (c, next) => {
      if (c.req.method !== 'POST' && c.req.method !== 'DELETE') return next();
      if (deps.requireApprovedClient) return deps.requireApprovedClient(c, next);
      return next();
    });
    routes.use(sub, async (c, next) => {
      if (c.req.method !== 'POST' && c.req.method !== 'DELETE') return next();
      if (deps.requireLegalConsent) return deps.requireLegalConsent(c, next);
      return next();
    });
    routes.use(sub, async (c, next) => {
      if (c.req.method !== 'POST' && c.req.method !== 'DELETE') return next();
      return writeLimit(c, next);
    });
  }

  routes.use('/:id/lemma-links', async (c, next) => {
    if (c.req.method === 'GET' && deps.optionalAuth) {
      return deps.optionalAuth(c, next);
    }
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
    return writeLimit(c, next);
  });
  routes.use('/:id/lemma-links/*', async (c, next) => {
    if (c.req.method !== 'POST' && c.req.method !== 'DELETE') return next();
    return deps.authenticate(c, next);
  });
  routes.use('/:id/lemma-links/*', async (c, next) => {
    if (c.req.method !== 'POST' && c.req.method !== 'DELETE') return next();
    if (deps.requireApprovedClient) return deps.requireApprovedClient(c, next);
    return next();
  });
  routes.use('/:id/lemma-links/*', async (c, next) => {
    if (c.req.method !== 'POST' && c.req.method !== 'DELETE') return next();
    if (deps.requireLegalConsent) return deps.requireLegalConsent(c, next);
    return next();
  });
  routes.use('/:id/lemma-links/*', async (c, next) => {
    if (c.req.method !== 'POST' && c.req.method !== 'DELETE') return next();
    return writeLimit(c, next);
  });

  for (const sub of ['/:id/promote-example', '/:id/translations'] as const) {
    routes.use(sub, async (c, next) => {
      if (c.req.method === 'GET' && deps.optionalAuth) {
        return deps.optionalAuth(c, next);
      }
      if (c.req.method !== 'POST') return next();
      return deps.authenticate(c, next);
    });
    routes.use(sub, async (c, next) => {
      if (c.req.method !== 'POST') return next();
      if (deps.requireApprovedClient) return deps.requireApprovedClient(c, next);
      return next();
    });
    routes.use(sub, async (c, next) => {
      if (c.req.method !== 'POST') return next();
      if (deps.requireLegalConsent) return deps.requireLegalConsent(c, next);
      return next();
    });
    routes.use(sub, async (c, next) => {
      if (c.req.method !== 'POST') return next();
      return writeLimit(c, next);
    });
  }

  // PATCH /:id edit body
  routes.use('/:id', async (c, next) => {
    if (c.req.method !== 'PATCH') return next();
    return deps.authenticate(c, next);
  });
  routes.use('/:id', async (c, next) => {
    if (c.req.method !== 'PATCH') return next();
    if (deps.requireApprovedClient) return deps.requireApprovedClient(c, next);
    return next();
  });
  routes.use('/:id', async (c, next) => {
    if (c.req.method !== 'PATCH') return next();
    if (deps.requireLegalConsent) return deps.requireLegalConsent(c, next);
    return next();
  });
  routes.use('/:id', async (c, next) => {
    if (c.req.method !== 'PATCH') return next();
    return writeLimit(c, next);
  });

  for (const sub of ['/:id/repost', '/:id/quote'] as const) {
    routes.use(sub, async (c, next) => {
      if (c.req.method !== 'POST' && c.req.method !== 'DELETE') return next();
      return deps.authenticate(c, next);
    });
    routes.use(sub, async (c, next) => {
      if (c.req.method !== 'POST' && c.req.method !== 'DELETE') return next();
      if (deps.requireApprovedClient) return deps.requireApprovedClient(c, next);
      return next();
    });
    routes.use(sub, async (c, next) => {
      if (c.req.method !== 'POST' && c.req.method !== 'DELETE') return next();
      if (deps.requireLegalConsent) return deps.requireLegalConsent(c, next);
      return next();
    });
    routes.use(sub, async (c, next) => {
      if (c.req.method !== 'POST' && c.req.method !== 'DELETE') return next();
      return writeLimit(c, next);
    });
  }
  routes.use('/:id/translations/*', async (c, next) => {
    if (c.req.method !== 'POST') return next();
    return deps.authenticate(c, next);
  });
  routes.use('/:id/translations/*', async (c, next) => {
    if (c.req.method !== 'POST') return next();
    if (deps.requireApprovedClient) return deps.requireApprovedClient(c, next);
    return next();
  });
  routes.use('/:id/translations/*', async (c, next) => {
    if (c.req.method !== 'POST') return next();
    if (deps.requireLegalConsent) return deps.requireLegalConsent(c, next);
    return next();
  });
  routes.use('/:id/translations/*', async (c, next) => {
    if (c.req.method !== 'POST') return next();
    return writeLimit(c, next);
  });

  routes.use('/archived', deps.authenticate);
  routes.openapi(uploadTokenRoute, (c) =>
    deps.controller.uploadCredentials(c, c.req.valid('query').folder) as never,
  );
  routes.openapi(createRouteDef, (c) =>
    deps.controller.create(c, c.req.valid('json')) as never,
  );
  routes.openapi(listRouteDef, (c) =>
    deps.controller.list(c, c.req.valid('query')) as never,
  );
  routes.openapi(listArchivedRoute, (c) =>
    deps.controller.listArchived(c, c.req.valid('query')) as never,
  );
  // Path spesifik sebelum /:id generik.
  routes.openapi(archiveRoute, (c) =>
    deps.controller.archive(c, c.req.valid('param').id) as never,
  );
  routes.openapi(unarchiveRoute, (c) =>
    deps.controller.unarchive(c, c.req.valid('param').id) as never,
  );
  routes.openapi(pinRoute, (c) =>
    deps.controller.pin(c, c.req.valid('param').id) as never,
  );
  routes.openapi(unpinRoute, (c) =>
    deps.controller.unpin(c, c.req.valid('param').id) as never,
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
  routes.openapi(promoteExampleRoute, (c) =>
    deps.controller.promoteExample(
      c,
      c.req.valid('param').id,
      c.req.valid('json'),
    ) as never,
  );
  routes.openapi(listTranslationsRoute, (c) =>
    deps.controller.listTranslations(c, c.req.valid('param').id) as never,
  );
  routes.openapi(createTranslationRoute, (c) =>
    deps.controller.createTranslation(
      c,
      c.req.valid('param').id,
      c.req.valid('json'),
    ) as never,
  );
  routes.use(
    '/:id/translations/:translationId/resolve',
    deps.authenticate,
    authorizeRole('root', 'admin', 'reviewer', 'editor', 'verifier'),
  );
  routes.openapi(resolveTranslationRoute, (c) => {
    const p = c.req.valid('param');
    return deps.controller.resolveTranslation(
      c,
      p.id,
      p.translationId,
      c.req.valid('json'),
    ) as never;
  });
  routes.openapi(editHistoryRoute, (c) =>
    deps.controller.editHistory(c, c.req.valid('param').id) as never,
  );
  routes.openapi(repostRoute, (c) =>
    deps.controller.repost(c, c.req.valid('param').id) as never,
  );
  routes.openapi(unrepostRoute, (c) =>
    deps.controller.unrepost(c, c.req.valid('param').id) as never,
  );
  routes.openapi(quoteRoute, (c) =>
    deps.controller.quote(
      c,
      c.req.valid('param').id,
      c.req.valid('json'),
    ) as never,
  );
  routes.openapi(attachAudioRoute, (c) =>
    deps.controller.attachAudio(c, c.req.valid('param').id) as never,
  );
  routes.openapi(listCommentsRoute, (c) =>
    deps.controller.listComments(c, c.req.valid('param').id) as never,
  );
  routes.openapi(createCommentRoute, (c) =>
    deps.controller.createComment(
      c,
      c.req.valid('param').id,
      c.req.valid('json'),
    ) as never,
  );
  routes.openapi(deleteCommentRoute, (c) => {
    const p = c.req.valid('param');
    return deps.controller.deleteComment(c, p.id, p.commentId) as never;
  });
  routes.openapi(updateJinyeRoute, (c) =>
    deps.controller.update(
      c,
      c.req.valid('param').id,
      c.req.valid('json'),
    ) as never,
  );
  routes.openapi(detailRouteDef, (c) =>
    deps.controller.detail(c, c.req.valid('param').id) as never,
  );
  routes.openapi(deleteRouteDef, (c) =>
    deps.controller.remove(c, c.req.valid('param').id) as never,
  );

  return routes;
}
