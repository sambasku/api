import type { MiddlewareHandler } from 'hono';
import { createRoute } from '@hono/zod-openapi';
import { z } from 'zod';
import { authorizeRole } from '@/shared/middlewares/authorize-role.middleware';
import { rateLimit } from '@/shared/middlewares/rate-limit.middleware';
import { createOpenApiApp } from '@/shared/openapi/openapi-app';
import { errorResponseSchema, okNullResponseSchema } from '@/shared/openapi/error-response.schema';
import type { AppVariables } from '@/shared/types';
import type { LayananCategoryController } from './layanan-category.controller';
import {
  createLayananCategoryBodySchema,
  layananCategoryIdQuerySchema,
  layananCategoryItemResponseSchema,
  layananCategoryListResponseSchema,
  listLayananCategoriesQuerySchema,
  updateLayananCategoryBodySchema,
} from './validators/layanan-category.validator';

const json = <T extends z.ZodType>(schema: T) => ({
  'application/json': { schema },
});

export function createPublicLayananCategoryRoutes(deps: { controller: LayananCategoryController }) {
  const routes = createOpenApiApp();
  routes.use('*', rateLimit({ points: 120, duration: 60 }));

  const listRoute = createRoute({
    method: 'get',
    path: '/',
    tags: ['Layanan categories'],
    summary: 'List kategori layanan publik (published + archived yang masih punya layanan)',
    responses: {
      200: { description: 'Daftar kategori', content: json(layananCategoryListResponseSchema) },
    },
  });

  routes.openapi(listRoute, (c) => deps.controller.listPublic(c) as never);
  return routes;
}

export function createAdminLayananCategoryRoutes(deps: {
  controller: LayananCategoryController;
  authenticate: MiddlewareHandler<{ Variables: AppVariables }>;
}) {
  const routes = createOpenApiApp();
  routes.use('*', rateLimit({ points: 60, duration: 60 }));
  routes.use('*', deps.authenticate, authorizeRole('root', 'admin', 'reviewer'));

  const listRoute = createRoute({
    method: 'get',
    path: '/',
    tags: ['Admin layanan categories'],
    summary: 'List kategori layanan (admin/reviewer)',
    request: { query: listLayananCategoriesQuerySchema },
    responses: {
      200: { description: 'Daftar kategori', content: json(layananCategoryListResponseSchema) },
      400: { description: 'Query tidak valid', content: json(errorResponseSchema) },
    },
  });

  const createRouteDef = createRoute({
    method: 'post',
    path: '/',
    tags: ['Admin layanan categories'],
    summary: 'Buat kategori layanan',
    request: { body: { content: { 'application/json': { schema: createLayananCategoryBodySchema } } } },
    responses: {
      200: { description: 'Kategori dibuat', content: json(layananCategoryItemResponseSchema) },
      400: { description: 'Body tidak valid', content: json(errorResponseSchema) },
      409: { description: 'Id atau label singkat bentrok', content: json(errorResponseSchema) },
    },
  });

  const updateRoute = createRoute({
    method: 'patch',
    path: '/by-id',
    tags: ['Admin layanan categories'],
    summary: 'Edit kategori layanan (id/slug tidak bisa diubah)',
    request: {
      query: layananCategoryIdQuerySchema,
      body: { content: { 'application/json': { schema: updateLayananCategoryBodySchema } } },
    },
    responses: {
      200: { description: 'Kategori diperbarui', content: json(layananCategoryItemResponseSchema) },
      404: { description: 'Tidak ditemukan', content: json(errorResponseSchema) },
      409: { description: 'Label singkat bentrok', content: json(errorResponseSchema) },
    },
  });

  const deleteRoute = createRoute({
    method: 'delete',
    path: '/by-id',
    tags: ['Admin layanan categories'],
    summary: 'Soft-delete kategori layanan (ditolak bila masih dipakai layanan)',
    request: { query: layananCategoryIdQuerySchema },
    responses: {
      200: { description: 'Terhapus', content: json(okNullResponseSchema) },
      404: { description: 'Tidak ditemukan', content: json(errorResponseSchema) },
      409: { description: 'Masih dipakai layanan', content: json(errorResponseSchema) },
    },
  });

  routes.openapi(listRoute, (c) => deps.controller.listAdmin(c, c.req.valid('query')) as never);
  routes.openapi(createRouteDef, (c) => deps.controller.create(c, c.req.valid('json')) as never);
  routes.openapi(updateRoute, (c) =>
    deps.controller.update(c, c.req.valid('query').id, c.req.valid('json')) as never,
  );
  routes.openapi(deleteRoute, (c) => deps.controller.remove(c, c.req.valid('query').id) as never);
  return routes;
}
