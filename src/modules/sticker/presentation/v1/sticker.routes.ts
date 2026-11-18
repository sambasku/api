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
});

const adminItemSchema = publicItemSchema.extend({
  sort_order: z.number(),
  is_active: z.boolean(),
});

const createBodySchema = z.object({
  id: z.string().min(1).max(64),
  image_url: z.string().url(),
  play_once: z.boolean().optional(),
  sort_order: z.number().int().min(0).max(9999).optional(),
  is_active: z.boolean().optional(),
});

const updateBodySchema = z.object({
  image_url: z.string().url().optional(),
  play_once: z.boolean().optional(),
  sort_order: z.number().int().min(0).max(9999).optional(),
  is_active: z.boolean().optional(),
});

const idParam = z.object({ id: z.string().min(1).max(64) });

export interface StickerRoutesDeps {
  controller: StickerController;
  authenticate: MiddlewareHandler<{ Variables: AppVariables }>;
}

export function createPublicStickerRoutes(deps: StickerRoutesDeps) {
  const routes = createOpenApiApp();
  routes.use('*', rateLimit({ points: 120, duration: 60 }));

  const listRoute = createRoute({
    method: 'get',
    path: '/',
    tags: ['Stickers'],
    summary: 'Daftar stiker aktif (chat + komentar)',
    responses: {
      200: {
        description: 'Katalog aktif',
        content: json(
          z.object({
            success: z.literal(true),
            data: z.array(publicItemSchema),
          }),
        ),
      },
    },
  });

  routes.openapi(listRoute, (c) => deps.controller.listPublic(c) as never);
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

  routes.openapi(listRoute, (c) => deps.controller.listAdmin(c) as never);
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
