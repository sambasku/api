import type { MiddlewareHandler } from 'hono';
import { createRoute } from '@hono/zod-openapi';
import { z } from 'zod';
import { authorizeRole } from '@/shared/middlewares/authorize-role.middleware';
import { rateLimit } from '@/shared/middlewares/rate-limit.middleware';
import { createOpenApiApp } from '@/shared/openapi/openapi-app';
import { errorResponseSchema, okNullResponseSchema } from '@/shared/openapi/error-response.schema';
import type { AppVariables } from '@/shared/types';
import type { CulinaryCategoryController } from './culinary-category.controller';
import {
  createCulinaryCategoryBodySchema,
  listCulinaryCategoriesQuerySchema,
  culinaryCategoryIdQuerySchema,
  culinaryCategoryItemResponseSchema,
  culinaryCategoryListResponseSchema,
  updateCulinaryCategoryBodySchema,
} from './validators/culinary-category.validator';

const json = <T extends z.ZodType>(schema: T) => ({
  'application/json': { schema },
});

export function createPublicCulinaryCategoryRoutes(deps: { controller: CulinaryCategoryController }) {
  const routes = createOpenApiApp();
  routes.use('*', rateLimit({ points: 120, duration: 60 }));

  const listRoute = createRoute({
    method: 'get',
    path: '/',
    tags: ['Culinary categories'],
    summary: 'List kategori kuliner published (publik)',
    request: { query: listCulinaryCategoriesQuerySchema },
    responses: {
      200: { description: 'Daftar kategori', content: json(culinaryCategoryListResponseSchema) },
      400: { description: 'Query tidak valid', content: json(errorResponseSchema) },
    },
  });

  const getRoute = createRoute({
    method: 'get',
    path: '/by-id',
    tags: ['Culinary categories'],
    summary: 'Detail kategori kuliner (publik)',
    request: { query: culinaryCategoryIdQuerySchema },
    responses: {
      200: { description: 'Detail kategori', content: json(culinaryCategoryItemResponseSchema) },
      404: { description: 'Tidak ditemukan', content: json(errorResponseSchema) },
    },
  });

  routes.openapi(listRoute, (c) => deps.controller.listPublic(c, c.req.valid('query')) as never);
  routes.openapi(getRoute, (c) => deps.controller.getById(c, c.req.valid('query').id) as never);
  return routes;
}

export function createAdminCulinaryCategoryRoutes(deps: {
  controller: CulinaryCategoryController;
  authenticate: MiddlewareHandler<{ Variables: AppVariables }>;
}) {
  const routes = createOpenApiApp();
  routes.use('*', rateLimit({ points: 60, duration: 60 }));
  routes.use('*', deps.authenticate, authorizeRole('root', 'admin', 'reviewer'));

  const listRoute = createRoute({
    method: 'get',
    path: '/',
    tags: ['Admin culinary categories'],
    summary: 'List kategori kuliner (admin/reviewer)',
    request: { query: listCulinaryCategoriesQuerySchema },
    responses: {
      200: { description: 'Daftar kategori', content: json(culinaryCategoryListResponseSchema) },
      400: { description: 'Query tidak valid', content: json(errorResponseSchema) },
    },
  });

  const createRouteDef = createRoute({
    method: 'post',
    path: '/',
    tags: ['Admin culinary categories'],
    summary: 'Buat kategori kuliner',
    request: { body: { content: { 'application/json': { schema: createCulinaryCategoryBodySchema } } } },
    responses: {
      200: { description: 'Kategori dibuat', content: json(culinaryCategoryItemResponseSchema) },
      400: { description: 'Body tidak valid', content: json(errorResponseSchema) },
      409: { description: 'Id bentrok', content: json(errorResponseSchema) },
    },
  });

  const updateRoute = createRoute({
    method: 'patch',
    path: '/by-id',
    tags: ['Admin culinary categories'],
    summary: 'Edit kategori kuliner',
    request: {
      query: culinaryCategoryIdQuerySchema,
      body: { content: { 'application/json': { schema: updateCulinaryCategoryBodySchema } } },
    },
    responses: {
      200: { description: 'Kategori diperbarui', content: json(culinaryCategoryItemResponseSchema) },
      404: { description: 'Tidak ditemukan', content: json(errorResponseSchema) },
    },
  });

  const deleteRoute = createRoute({
    method: 'delete',
    path: '/by-id',
    tags: ['Admin culinary categories'],
    summary: 'Soft-delete kategori kuliner',
    request: { query: culinaryCategoryIdQuerySchema },
    responses: {
      200: { description: 'Terhapus', content: json(okNullResponseSchema) },
      404: { description: 'Tidak ditemukan', content: json(errorResponseSchema) },
      409: { description: 'Masih dipakai kuliner', content: json(errorResponseSchema) },
    },
  });

  routes.openapi(listRoute, (c) => deps.controller.listAdmin(c, c.req.valid('query')) as never);
  routes.openapi(createRouteDef, (c) => deps.controller.create(c, c.req.valid('json')) as never);
  routes.openapi(updateRoute, (c) =>
    deps.controller.update(c, c.req.valid('query').id, c.req.valid('json')) as never,
  );
  routes.openapi(deleteRoute, (c) =>
    deps.controller.remove(c, c.req.valid('query').id) as never,
  );
  return routes;
}
