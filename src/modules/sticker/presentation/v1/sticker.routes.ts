import type { MiddlewareHandler } from 'hono';
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
import type { StickerController } from './sticker.controller';

const json = <T extends z.ZodType>(schema: T) => ({
  'application/json': { schema },
});

const publicItemSchema = z.object({
  id: z.string(),
  image_url: z.string(),
  play_once: z.boolean(),
  category_slug: z.string().nullable(),
  display_name: z.string().nullable(),
  is_custom: z.boolean(),
  source_sticker_id: z.string().nullable(),
});

const adminItemSchema = publicItemSchema.extend({
  sort_order: z.number(),
  is_active: z.boolean(),
  visibility: z.enum(['public', 'private']),
  owner_user_id: z.string().nullable(),
});

const uploadTokenSchema = z.object({
  token: z.string(),
  signature: z.string(),
  expire: z.number(),
  public_key: z.string(),
  upload_endpoint: z.string(),
});

const createBodySchema = z.object({
  id: z.string().min(1).max(64),
  image_url: z.string().url(),
  play_once: z.boolean().optional(),
  sort_order: z.number().int().min(0).max(9999).optional(),
  is_active: z.boolean().optional(),
  category_slug: z.string().max(64).nullable().optional(),
});

const createMineBodySchema = z.object({
  name: z.string().trim().max(30).nullable().optional(),
  image_url: z.string().url(),
  provider_file_id: z.string().trim().max(128).nullable().optional(),
  play_once: z.boolean().optional(),
});

const updateBodySchema = z.object({
  image_url: z.string().url().optional(),
  play_once: z.boolean().optional(),
  sort_order: z.number().int().min(0).max(9999).optional(),
  is_active: z.boolean().optional(),
  category_slug: z.string().max(64).nullable().optional(),
});

const listQuerySchema = z.object({
  q: z.string().max(64).optional(),
  category_slug: z.string().max(64).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
  cursor: z.string().max(128).optional(),
});

const adminListQuerySchema = z.object({
  visibility: z.enum(['all', 'public', 'private']).optional(),
});

const idParam = z.object({ id: z.string().min(1).max(64) });

export interface StickerRoutesDeps {
  controller: StickerController;
  authenticate: MiddlewareHandler<{ Variables: AppVariables }>;
}

export function createPublicStickerRoutes(deps: StickerRoutesDeps) {
  const routes = createOpenApiApp();
  routes.use('*', rateLimit({ points: 120, duration: 60 }));

  // Auth & rate limit khusus endpoint user (daftar sebelum `/{id}`)
  routes.use('/upload-token', deps.authenticate, rateLimit({ points: 20, duration: 60 }));
  routes.use('/favorites', deps.authenticate, rateLimit({ points: 60, duration: 60 }));
  routes.use('/favorites/*', deps.authenticate, rateLimit({ points: 30, duration: 60 }));
  routes.use('/mine', deps.authenticate);
  routes.use('/mine/*', deps.authenticate, rateLimit({ points: 30, duration: 60 }));

  const listRoute = createRoute({
    method: 'get',
    path: '/',
    tags: ['Stickers'],
    summary: 'Daftar stiker aktif publik (chat + komentar)',
    request: { query: listQuerySchema },
    responses: {
      200: {
        description: 'Katalog aktif publik + meta kategori',
        content: json(
          z.object({
            success: z.literal(true),
            data: z.array(publicItemSchema),
            meta: z.object({
              next_cursor: z.string().nullable(),
              categories: z.array(z.string()),
            }),
          }),
        ),
      },
    },
  });

  const uploadTokenRoute = createRoute({
    method: 'get',
    path: '/upload-token',
    tags: ['Stickers'],
    summary: 'Token direct upload ImageKit untuk custom stiker (/stickers/custom)',
    responses: {
      200: {
        description: 'Kredensial upload ImageKit',
        content: json(
          z.object({ success: z.literal(true), data: uploadTokenSchema }),
        ),
      },
      401: { description: 'Belum login', content: json(errorResponseSchema) },
      503: { description: 'Storage belum siap', content: json(errorResponseSchema) },
    },
  });

  const listFavoritesRoute = createRoute({
    method: 'get',
    path: '/favorites',
    tags: ['Stickers'],
    summary: 'Daftar stiker favorit user login',
    responses: {
      200: {
        description: 'Daftar favorit aktif',
        content: json(
          z.object({
            success: z.literal(true),
            data: z.array(publicItemSchema),
          }),
        ),
      },
      401: { description: 'Belum login', content: json(errorResponseSchema) },
    },
  });

  const addFavoriteRoute = createRoute({
    method: 'put',
    path: '/favorites/{id}',
    tags: ['Stickers'],
    summary: 'Tambah stiker ke favorit user (idempoten)',
    request: { params: idParam },
    responses: {
      200: {
        description: 'Ditambahkan ke favorit',
        content: json(
          z.object({ success: z.literal(true), data: publicItemSchema }),
        ),
      },
      400: { description: 'Kuota favorit penuh', content: json(errorResponseSchema) },
      401: { description: 'Belum login', content: json(errorResponseSchema) },
      404: { description: 'Stiker tidak ada', content: json(errorResponseSchema) },
    },
  });

  const removeFavoriteRoute = createRoute({
    method: 'delete',
    path: '/favorites/{id}',
    tags: ['Stickers'],
    summary: 'Hapus stiker dari favorit user (idempoten)',
    request: { params: idParam },
    responses: {
      200: { description: 'Terhapus dari favorit', content: json(okNullResponseSchema) },
      401: { description: 'Belum login', content: json(errorResponseSchema) },
    },
  });

  const listMineRoute = createRoute({
    method: 'get',
    path: '/mine',
    tags: ['Stickers'],
    summary: 'Daftar custom stiker privat milik user login',
    responses: {
      200: {
        description: 'Daftar custom stiker aktif milik user',
        content: json(
          z.object({
            success: z.literal(true),
            data: z.array(publicItemSchema),
          }),
        ),
      },
      401: { description: 'Belum login', content: json(errorResponseSchema) },
    },
  });

  const createMineRoute = createRoute({
    method: 'post',
    path: '/mine',
    tags: ['Stickers'],
    summary: 'Buat custom stiker privat (<nama>-<ulid>)',
    middleware: [rateLimit({ points: 5, duration: 3600 })] as const,
    request: {
      body: { content: { 'application/json': { schema: createMineBodySchema } } },
    },
    responses: {
      201: {
        description: 'Custom stiker dibuat',
        content: json(
          z.object({ success: z.literal(true), data: publicItemSchema }),
        ),
      },
      400: { description: 'Validasi / kuota penuh', content: json(errorResponseSchema) },
      401: { description: 'Belum login', content: json(errorResponseSchema) },
    },
  });

  const removeMineRoute = createRoute({
    method: 'delete',
    path: '/mine/{id}',
    tags: ['Stickers'],
    summary: 'Hapus custom stiker milik user login',
    request: { params: idParam },
    responses: {
      200: { description: 'Terhapus', content: json(okNullResponseSchema) },
      401: { description: 'Belum login', content: json(errorResponseSchema) },
      404: { description: 'Tidak ada / bukan milik kamu', content: json(errorResponseSchema) },
    },
  });

  const getRoute = createRoute({
    method: 'get',
    path: '/{id}',
    tags: ['Stickers'],
    summary: 'Detail stiker aktif by id (publik + custom)',
    request: { params: idParam },
    responses: {
      200: {
        description: 'Satu stiker',
        content: json(
          z.object({ success: z.literal(true), data: publicItemSchema }),
        ),
      },
      404: { description: 'Tidak ada', content: json(errorResponseSchema) },
    },
  });

  routes.openapi(listRoute, (c) =>
    deps.controller.listPublic(c, c.req.valid('query')) as never,
  );
  routes.openapi(uploadTokenRoute, (c) =>
    deps.controller.getUploadToken(c) as never,
  );
  routes.openapi(listFavoritesRoute, (c) =>
    deps.controller.listFavorites(c) as never,
  );
  routes.openapi(addFavoriteRoute, (c) =>
    deps.controller.addFavorite(c, c.req.valid('param').id) as never,
  );
  routes.openapi(removeFavoriteRoute, (c) =>
    deps.controller.removeFavorite(c, c.req.valid('param').id) as never,
  );
  routes.openapi(listMineRoute, (c) =>
    deps.controller.listMine(c) as never,
  );
  routes.openapi(createMineRoute, (c) =>
    deps.controller.createMine(c, c.req.valid('json')) as never,
  );
  routes.openapi(removeMineRoute, (c) =>
    deps.controller.removeMine(c, c.req.valid('param').id) as never,
  );
  routes.openapi(getRoute, (c) =>
    deps.controller.getPublic(c, c.req.valid('param').id) as never,
  );
  return routes;
}

export function createAdminStickerRoutes(deps: StickerRoutesDeps) {
  const routes = createOpenApiApp();
  routes.use('*', rateLimit({ points: 60, duration: 60 }));
  routes.use('*', deps.authenticate, authorizeRole('root', 'admin'));

  const listRoute = createRoute({
    method: 'get',
    path: '/',
    tags: ['Stickers Admin'],
    summary: 'Daftar semua stiker (admin)',
    request: { query: adminListQuerySchema },
    responses: {
      200: {
        description: 'Katalog admin',
        content: json(
          z.object({
            success: z.literal(true),
            data: z.array(adminItemSchema),
          }),
        ),
      },
    },
  });

  const createRouteDef = createRoute({
    method: 'post',
    path: '/',
    tags: ['Stickers Admin'],
    summary: 'Tambah stiker',
    request: {
      body: { content: { 'application/json': { schema: createBodySchema } } },
    },
    responses: {
      201: {
        description: 'Dibuat',
        content: json(
          z.object({ success: z.literal(true), data: adminItemSchema }),
        ),
      },
      400: { description: 'Validasi', content: json(errorResponseSchema) },
      409: { description: 'Id bentrok', content: json(errorResponseSchema) },
    },
  });

  const updateRouteDef = createRoute({
    method: 'patch',
    path: '/:id',
    tags: ['Stickers Admin'],
    summary: 'Ubah stiker',
    request: {
      params: idParam,
      body: { content: { 'application/json': { schema: updateBodySchema } } },
    },
    responses: {
      200: {
        description: 'Diperbarui',
        content: json(
          z.object({ success: z.literal(true), data: adminItemSchema }),
        ),
      },
      404: { description: 'Tidak ada', content: json(errorResponseSchema) },
    },
  });

  const deleteRouteDef = createRoute({
    method: 'delete',
    path: '/:id',
    tags: ['Stickers Admin'],
    summary: 'Soft-delete stiker',
    request: { params: idParam },
    responses: {
      200: { description: 'Terhapus', content: json(okNullResponseSchema) },
      404: { description: 'Tidak ada', content: json(errorResponseSchema) },
    },
  });

  routes.openapi(listRoute, (c) =>
    deps.controller.listAdmin(c, c.req.valid('query')) as never,
  );
  routes.openapi(createRouteDef, (c) =>
    deps.controller.create(c, c.req.valid('json')) as never,
  );
  routes.openapi(updateRouteDef, (c) =>
    deps.controller.update(c, c.req.param('id'), c.req.valid('json')) as never,
  );
  routes.openapi(deleteRouteDef, (c) =>
    deps.controller.remove(c, c.req.param('id')) as never,
  );

  return routes;
}
