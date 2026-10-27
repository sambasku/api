import type { MiddlewareHandler } from 'hono';
import { createRoute } from '@hono/zod-openapi';
import { z } from 'zod';
import { rateLimit } from '@/shared/middlewares/rate-limit.middleware';
import { createOpenApiApp } from '@/shared/openapi/openapi-app';
import { errorResponseSchema } from '@/shared/openapi/error-response.schema';
import type { AppVariables } from '@/shared/types';
import type { PantunController } from './pantun.controller';
import {
  createPantunBodySchema,
  createPantunReplyBodySchema,
  createPantunResponseSchema,
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
  // Balas pantun = POST /:id/replies (bukan /replies/:id yang hanya DELETE).
  routes.use(
    '/:id/replies',
    deps.authenticate,
    ...writeClient,
    ...legalConsent,
    writeLimit,
  );
  routes.use('/replies/:id', deps.authenticate, ...writeClient, ...legalConsent);

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
  routes.openapi(createReplyRoute, (c) =>
    deps.controller.createReply(
      c,
      c.req.valid('param').id,
      c.req.valid('json'),
    ) as never,
  );
  // Route /replies/:id sebelum /:id sudah aman: Hono match urutan daftar.
  routes.openapi(deleteReplyRoute, (c) =>
    deps.controller.deleteReply(c, c.req.valid('param').id) as never,
  );
  routes.openapi(deletePantunRoute, (c) =>
    deps.controller.deletePantun(c, c.req.valid('param').id) as never,
  );
  return routes;
}

