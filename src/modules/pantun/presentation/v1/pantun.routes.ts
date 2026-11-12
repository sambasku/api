import type { MiddlewareHandler } from 'hono';
import { createRoute } from '@hono/zod-openapi';
import { bodyLimit } from 'hono/body-limit';
import { z } from 'zod';
import { rateLimit } from '@/shared/middlewares/rate-limit.middleware';
import { createOpenApiApp } from '@/shared/openapi/openapi-app';
import { errorResponseSchema } from '@/shared/openapi/error-response.schema';
import type { AppVariables } from '@/shared/types';
import type { PantunController } from './pantun.controller';
import {
  createPantunBodySchema,
  createPantunReplyBodySchema,
  updatePantunReplyBodySchema,
  createPantunResponseSchema,
  pantunReplyEditHistoryResponseSchema,
  pantunDetailResponseSchema,
  pantunIdParamSchema,
  pantunReplyIdParamSchema,
  listPantunsQuerySchema,
  listPantunsResponseSchema,
  pantunSearchQuerySchema,
  searchPantunsResponseSchema,
  deletePantunResponseSchema,
} from './validators/pantun.validator';

const json = <T extends z.ZodType>(schema: T) => ({
  'application/json': { schema },
});

export interface PantunRoutesDeps {
  controller: PantunController;
  authenticate: MiddlewareHandler<{ Variables: AppVariables }>;
  /** Gate azp + scope ugc.write pada tulis (opsional di dev). */
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

function pantunUserLimit(
  onUgcRateLimited?: (userId: string) => void | Promise<void>,
) {
  return rateLimit({
    points: 30,
    duration: 3600,
    keyFn: (c) => {
      const uid = (
        c as { get: (k: 'user') => { user_id: string } | undefined }
      ).get('user')?.user_id;
      return uid ? `pantun:user:${uid}` : '';
    },
    onLimited: ugcRateLimitedHook(onUgcRateLimited),
  });
}

/** Audio pantun: lebih ketat dari teks (10/jam). */
function pantunAudioUserLimit(
  onUgcRateLimited?: (userId: string) => void | Promise<void>,
) {
  return rateLimit({
    points: 10,
    duration: 3600,
    keyFn: (c) => {
      const uid = (
        c as { get: (k: 'user') => { user_id: string } | undefined }
      ).get('user')?.user_id;
      return uid ? `pantun-audio:user:${uid}` : '';
    },
    onLimited: ugcRateLimitedHook(onUgcRateLimited),
  });
}

const audioBodyLimit = bodyLimit({
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
});

const createWithAudioRoute = createRoute({
  method: 'post',
  path: '/audio',
  tags: ['Pantun'],
  summary: 'Kirim pantun 4 baris + bacaan suara (multipart; 10-60s)',
  request: {
    body: {
      content: {
        'multipart/form-data': {
          schema: z.object({
            audio: z.any().openapi({ type: 'string', format: 'binary' }),
            lines: z.string().openapi({
              description: 'JSON array 4 baris pantun',
            }),
            duration_ms: z.string().optional(),
            rhyme_scheme: z.enum(['ABAB', 'AAAA']).optional(),
            category_id: z.string().optional(),
            language: z.string().optional(),
          }),
        },
      },
    },
  },
  responses: {
    201: {
      description: 'Tersimpan published + audio',
      content: json(createPantunResponseSchema),
    },
    400: {
      description: 'Struktur/rima/durasi/MIME tidak valid',
      content: json(errorResponseSchema),
    },
    401: { description: 'Token tidak ada/invalid', content: json(errorResponseSchema) },
    429: { description: 'Rate limit', content: json(errorResponseSchema) },
    503: {
      description: 'Storage audio belum dikonfigurasi',
      content: json(errorResponseSchema),
    },
  },
});

const createReplyWithAudioRoute = createRoute({
  method: 'post',
  path: '/:id/replies/audio',
  tags: ['Pantun'],
  summary: 'Balas pantun dengan teks + bacaan suara (multipart; 10-60s)',
  request: {
    params: pantunIdParamSchema,
    body: {
      content: {
        'multipart/form-data': {
          schema: z.object({
            audio: z.any().openapi({ type: 'string', format: 'binary' }),
            lines: z.string().openapi({
              description: 'JSON array 4 baris pantun',
            }),
            duration_ms: z.string().optional(),
            rhyme_scheme: z.enum(['ABAB', 'AAAA']).optional(),
            category_id: z.string().optional(),
            language: z.string().optional(),
          }),
        },
      },
    },
  },
  responses: {
    201: {
      description: 'Balasan tersimpan + audio',
      content: json(createPantunResponseSchema),
    },
    400: {
      description: 'Struktur/rima/durasi/MIME tidak valid',
      content: json(errorResponseSchema),
    },
    401: { description: 'Token tidak ada/invalid', content: json(errorResponseSchema) },
    404: { description: 'Pantun tidak ditemukan', content: json(errorResponseSchema) },
    429: { description: 'Rate limit', content: json(errorResponseSchema) },
    503: {
      description: 'Storage audio belum dikonfigurasi',
      content: json(errorResponseSchema),
    },
  },
});

const createRouteDef = createRoute({
  method: 'post',
  path: '/',
  tags: ['Pantun'],
  summary: 'Kirim pantun 4 baris (login; langsung tayang)',
  request: { body: { content: json(createPantunBodySchema) } },
  responses: {
    201: { description: 'Tersimpan published', content: json(createPantunResponseSchema) },
    400: { description: 'Struktur/rima tidak valid', content: json(errorResponseSchema) },
    401: { description: 'Token tidak ada/invalid', content: json(errorResponseSchema) },
    429: { description: 'Rate limit', content: json(errorResponseSchema) },
  },
});

const listRoute = createRoute({
  method: 'get',
  path: '/',
  tags: ['Pantun'],
  summary: 'Feed pantun tayang (publik)',
  request: { query: listPantunsQuerySchema },
  responses: {
    200: { description: 'Daftar published', content: json(listPantunsResponseSchema) },
  },
});

const detailRoute = createRoute({
  method: 'get',
  path: '/:id',
  tags: ['Pantun'],
  summary: 'Detail pantun + balasan (publik)',
  request: { params: pantunIdParamSchema },
  responses: {
    200: { description: 'Detail + balasan', content: json(pantunDetailResponseSchema) },
    404: { description: 'Tidak ditemukan / tidak tayang', content: json(errorResponseSchema) },
  },
});

const searchRoute = createRoute({
  method: 'get',
  path: '/search',
  tags: ['Pantun'],
  summary: 'Cari pantun + balasan tayang (FTS, publik)',
  request: { query: pantunSearchQuerySchema },
  responses: {
    200: { description: 'Hasil pencarian', content: json(searchPantunsResponseSchema) },
    400: { description: 'Kata kunci kosong/invalid', content: json(errorResponseSchema) },
  },
});

const createReplyRoute = createRoute({
  method: 'post',
  path: '/:id/replies',
  tags: ['Pantun'],
  summary: 'Balas pantun pembuka (login)',
  request: {
    params: pantunIdParamSchema,
    body: { content: json(createPantunReplyBodySchema) },
  },
  responses: {
    201: { description: 'Balasan tersimpan', content: json(createPantunResponseSchema) },
    400: { description: 'Struktur/rima tidak valid', content: json(errorResponseSchema) },
    401: { description: 'Token tidak ada/invalid', content: json(errorResponseSchema) },
    404: { description: 'Pantun tidak ditemukan', content: json(errorResponseSchema) },
    429: { description: 'Rate limit', content: json(errorResponseSchema) },
  },
});

const updateReplyRoute = createRoute({
  method: 'patch',
  path: '/replies/:id',
  tags: ['Pantun'],
  summary: 'Edit balasan sendiri (4 baris + rima)',
  request: {
    params: pantunReplyIdParamSchema,
    body: { content: json(updatePantunReplyBodySchema) },
  },
  responses: {
    200: { description: 'Balasan diperbarui', content: json(createPantunResponseSchema) },
    400: { description: 'Struktur/rima/blocklist tidak valid', content: json(errorResponseSchema) },
    401: { description: 'Token tidak ada/invalid', content: json(errorResponseSchema) },
    403: { description: 'Bukan penulis', content: json(errorResponseSchema) },
    404: { description: 'Balasan tidak ditemukan', content: json(errorResponseSchema) },
    429: { description: 'Rate limit', content: json(errorResponseSchema) },
  },
});

const replyEditHistoryRoute = createRoute({
  method: 'get',
  path: '/replies/:id/edit-history',
  tags: ['Pantun'],
  summary: 'Riwayat sunting balasan (publik, hanya published)',
  request: { params: pantunReplyIdParamSchema },
  responses: {
    200: {
      description: 'Versi tayang + snapshot sebelumnya',
      content: json(pantunReplyEditHistoryResponseSchema),
    },
    404: { description: 'Balasan tidak ditemukan / tidak tayang', content: json(errorResponseSchema) },
  },
});

const deleteReplyRoute = createRoute({
  method: 'delete',
  path: '/replies/:id',
  tags: ['Pantun'],
  summary: 'Hapus balasan sendiri',
  request: { params: pantunReplyIdParamSchema },
  responses: {
    200: { description: 'Dihapus', content: json(deletePantunResponseSchema) },
    401: { description: 'Token tidak ada/invalid', content: json(errorResponseSchema) },
    403: { description: 'Bukan penulis', content: json(errorResponseSchema) },
    404: { description: 'Balasan tidak ditemukan', content: json(errorResponseSchema) },
  },
});

const deletePantunRoute = createRoute({
  method: 'delete',
  path: '/:id',
  tags: ['Pantun'],
  summary: 'Hapus pantun sendiri',
  request: { params: pantunIdParamSchema },
  responses: {
    200: { description: 'Dihapus', content: json(deletePantunResponseSchema) },
    401: { description: 'Token tidak ada/invalid', content: json(errorResponseSchema) },
    403: { description: 'Bukan penulis', content: json(errorResponseSchema) },
    404: { description: 'Pantun tidak ditemukan', content: json(errorResponseSchema) },
  },
});

export function createPantunRoutes(deps: PantunRoutesDeps) {
  const routes = createOpenApiApp();
  const writeClient = deps.requireApprovedClient
    ? [deps.requireApprovedClient]
    : [];
  const legalConsent = deps.requireLegalConsent ? [deps.requireLegalConsent] : [];
  const writeLimit = pantunUserLimit(deps.onUgcRateLimited);
  const audioLimit = pantunAudioUserLimit(deps.onUgcRateLimited);

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
  routes.use(
    '/audio',
    deps.authenticate,
    ...writeClient,
    ...legalConsent,
    audioLimit,
    audioBodyLimit,
  );
  // Balas pantun = POST /:id/replies (bukan /replies/:id yang hanya DELETE).
  routes.use(
    '/:id/replies/audio',
    deps.authenticate,
    ...writeClient,
    ...legalConsent,
    audioLimit,
    audioBodyLimit,
  );
  routes.use(
    '/:id/replies',
    deps.authenticate,
    ...writeClient,
    ...legalConsent,
    writeLimit,
  );
  routes.use('/replies/:id', async (c, next) => {
    if (c.req.method === 'GET') return next();
    return deps.authenticate(c, next);
  });
  routes.use('/replies/:id', async (c, next) => {
    if (c.req.method === 'GET') return next();
    if (deps.requireApprovedClient) return deps.requireApprovedClient(c, next);
    return next();
  });
  routes.use('/replies/:id', async (c, next) => {
    if (c.req.method === 'GET') return next();
    if (deps.requireLegalConsent) return deps.requireLegalConsent(c, next);
    return next();
  });
  routes.use('/replies/:id', async (c, next) => {
    if (c.req.method === 'PATCH') return writeLimit(c, next);
    return next();
  });

  // DELETE /:id (hapus pantun sendiri). Hanya DELETE yang digerbangi:
  // GET /search dan GET /:id tetap publik.
  routes.use('/:id', async (c, next) => {
    if (c.req.method !== 'DELETE') return next();
    return deps.authenticate(c, next);
  });
  routes.use('/:id', async (c, next) => {
    if (c.req.method !== 'DELETE') return next();
    if (deps.requireApprovedClient) return deps.requireApprovedClient(c, next);
    return next();
  });
  routes.use('/:id', async (c, next) => {
    if (c.req.method !== 'DELETE') return next();
    if (deps.requireLegalConsent) return deps.requireLegalConsent(c, next);
    return next();
  });

  // '/audio' SEBELUM '/:id': literal harus menang.
  routes.openapi(createWithAudioRoute, (c) =>
    deps.controller.createWithAudio(c) as never,
  );
  routes.openapi(createRouteDef, (c) =>
    deps.controller.create(c, c.req.valid('json')) as never,
  );
  routes.openapi(listRoute, (c) =>
    deps.controller.listPublished(c, c.req.valid('query')) as never,
  );
  // '/search' SEBELUM '/:id': literal harus menang dari param opaqueId.
  routes.openapi(searchRoute, (c) =>
    deps.controller.search(c, c.req.valid('query')) as never,
  );
  routes.openapi(detailRoute, (c) =>
    deps.controller.getDetail(c, c.req.valid('param').id) as never,
  );
  routes.openapi(createReplyWithAudioRoute, (c) =>
    deps.controller.createReplyWithAudio(c, c.req.valid('param').id) as never,
  );
  routes.openapi(createReplyRoute, (c) =>
    deps.controller.createReply(
      c,
      c.req.valid('param').id,
      c.req.valid('json'),
    ) as never,
  );
  // Route /replies/:id sebelum /:id sudah aman: Hono match urutan daftar.
  routes.openapi(replyEditHistoryRoute, (c) =>
    deps.controller.getReplyEditHistory(c, c.req.valid('param').id) as never,
  );
  routes.openapi(updateReplyRoute, (c) =>
    deps.controller.updateReply(
      c,
      c.req.valid('param').id,
      c.req.valid('json'),
    ) as never,
  );
  routes.openapi(deleteReplyRoute, (c) =>
    deps.controller.deleteReply(c, c.req.valid('param').id) as never,
  );
  routes.openapi(deletePantunRoute, (c) =>
    deps.controller.deletePantun(c, c.req.valid('param').id) as never,
  );
  return routes;
}

