import type { MiddlewareHandler } from 'hono';
import { createRoute } from '@hono/zod-openapi';
import { z } from 'zod';
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
  deleteJinyeCommentResponseSchema,
  deleteJinyeResponseSchema,
  jinyeCommentIdParamSchema,
  jinyeDetailResponseSchema,
  jinyeIdParamSchema,
  jinyeUploadTokenQuerySchema,
  listJinyeCommentsResponseSchema,
  listJinyeQuerySchema,
  listJinyeResponseSchema,
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
    429: { description: 'Kuota 24 jam', content: json(errorResponseSchema) },
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

  routes.openapi(uploadTokenRoute, (c) =>
    deps.controller.uploadCredentials(c, c.req.valid('query').folder) as never,
  );
  routes.openapi(createRouteDef, (c) =>
    deps.controller.create(c, c.req.valid('json')) as never,
  );
  routes.openapi(listRouteDef, (c) =>
    deps.controller.list(c, c.req.valid('query')) as never,
  );
  // Path spesifik sebelum /:id generik.
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
  routes.openapi(detailRouteDef, (c) =>
    deps.controller.detail(c, c.req.valid('param').id) as never,
  );
  routes.openapi(deleteRouteDef, (c) =>
    deps.controller.remove(c, c.req.valid('param').id) as never,
  );

  return routes;
}
