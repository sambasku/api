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
import type { ProfileCoverController } from './profile-cover.controller';

const json = <T extends z.ZodType>(schema: T) => ({
  'application/json': { schema },
});

const variantSchema = z.enum(['tab', 'public', 'wotd']);

const adminItemSchema = z.object({
  id: z.string(),
  variant: variantSchema,
  url: z.string(),
  file_id: z.string().nullable(),
  width: z.number(),
  height: z.number(),
  size_bytes: z.number().nullable(),
  is_active: z.boolean(),
  created_by: z.string().nullable(),
  created_at: z.string(),
  activated_at: z.string().nullable(),
});

const createBodySchema = z.object({
  variant: variantSchema,
  url: z.string().url(),
  file_id: z.string().max(128).nullable().optional(),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  size_bytes: z.number().int().nonnegative().nullable().optional(),
  activate: z.boolean().optional(),
});

const listQuerySchema = z.object({
  variant: variantSchema,
});

const idParam = z.object({ id: z.string().uuid() });

export interface ProfileCoverRoutesDeps {
  controller: ProfileCoverController;
  authenticate: MiddlewareHandler<{ Variables: AppVariables }>;
}

export function createPublicProfileCoverRoutes(deps: {
  controller: ProfileCoverController;
}) {
  const routes = createOpenApiApp();
  routes.use('*', rateLimit({ points: 120, duration: 60 }));

  const route = createRoute({
    method: 'get',
    path: '/profile-covers',
    tags: ['About'],
    summary: 'Cover profil global aktif (tab + publik)',
    responses: {
      200: {
        description: 'URL cover aktif',
        content: json(
          z.object({
            success: z.literal(true),
            data: z.object({
              tab_url: z.string().nullable(),
              public_url: z.string().nullable(),
              wotd_url: z.string().nullable(),
            }),
          }),
        ),
      },
    },
  });

  routes.openapi(route, (c) => deps.controller.listPublic(c) as never);
  return routes;
}

export function createAdminProfileCoverRoutes(deps: ProfileCoverRoutesDeps) {
  const routes = createOpenApiApp();
  routes.use('*', rateLimit({ points: 60, duration: 60 }));
  routes.use('*', deps.authenticate, authorizeRole('root', 'admin'));

  const listRoute = createRoute({
    method: 'get',
    path: '/',
    tags: ['Profile Covers Admin'],
    summary: 'Riwayat cover per varian',
    request: { query: listQuerySchema },
    responses: {
      200: {
        description: 'Riwayat',
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
    tags: ['Profile Covers Admin'],
    summary: 'Unggah cover baru (opsional langsung aktif)',
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
    },
  });

  const activateRoute = createRoute({
    method: 'post',
    path: '/{id}/activate',
    tags: ['Profile Covers Admin'],
    summary: 'Aktifkan cover dari riwayat',
    request: { params: idParam },
    responses: {
      200: {
        description: 'Diaktifkan',
        content: json(
          z.object({ success: z.literal(true), data: adminItemSchema }),
        ),
      },
      404: { description: 'Tidak ada', content: json(errorResponseSchema) },
    },
  });

  const deleteRoute = createRoute({
    method: 'delete',
    path: '/{id}',
    tags: ['Profile Covers Admin'],
    summary: 'Hapus cover dari riwayat (bukan yang aktif)',
    request: { params: idParam },
    responses: {
      200: { description: 'Terhapus', content: json(okNullResponseSchema) },
      404: { description: 'Tidak ada', content: json(errorResponseSchema) },
      409: { description: 'Masih aktif', content: json(errorResponseSchema) },
    },
  });

  routes.openapi(listRoute, (c) =>
    deps.controller.listAdmin(c, c.req.valid('query')) as never,
  );
  routes.openapi(createRouteDef, (c) =>
    deps.controller.create(c, c.req.valid('json')) as never,
  );
  routes.openapi(activateRoute, (c) =>
    deps.controller.activate(c, c.req.valid('param').id) as never,
  );
  routes.openapi(deleteRoute, (c) =>
    deps.controller.remove(c, c.req.valid('param').id) as never,
  );

  return routes;
}