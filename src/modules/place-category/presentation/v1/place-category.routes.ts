import type { MiddlewareHandler } from 'hono';
import { createRoute } from '@hono/zod-openapi';
import { z } from 'zod';
import { authorizeRole } from '@/shared/middlewares/authorize-role.middleware';
import { rateLimit } from '@/shared/middlewares/rate-limit.middleware';
import { createOpenApiApp } from '@/shared/openapi/openapi-app';
import { errorResponseSchema, okNullResponseSchema } from '@/shared/openapi/error-response.schema';
import type { AppVariables } from '@/shared/types';
import type { PlaceCategoryController } from './place-category.controller';
import {
  createPlaceCategoryBodySchema,
  listPlaceCategoriesQuerySchema,
  placeCategoryIdQuerySchema,
  placeCategoryItemResponseSchema,
  placeCategoryListResponseSchema,
  updatePlaceCategoryBodySchema,
} from './validators/place-category.validator';

const json = <T extends z.ZodType>(schema: T) => ({
  'application/json': { schema },
});

export function createPublicPlaceCategoryRoutes(deps: { controller: PlaceCategoryController }) {
  const routes = createOpenApiApp();
  routes.use('*', rateLimit({ points: 120, duration: 60 }));

  const listRoute = createRoute({
    method: 'get',
    path: '/',
    tags: ['Place categories'],
    summary: 'List kategori place published (publik)',
    request: { query: listPlaceCategoriesQuerySchema },
    responses: {
      200: { description: 'Daftar kategori', content: json(placeCategoryListResponseSchema) },
      400: { description: 'Query tidak valid', content: json(errorResponseSchema) },
    },
  });

  const getRoute = createRoute({
    method: 'get',
    path: '/by-id',
    tags: ['Place categories'],
    summary: 'Detail kategori place (publik)',
    request: { query: placeCategoryIdQuerySchema },
    responses: {
      200: { description: 'Detail kategori', content: json(placeCategoryItemResponseSchema) },
      404: { description: 'Tidak ditemukan', content: json(errorResponseSchema) },
    },
  });

  routes.openapi(listRoute, (c) => deps.controller.listPublic(c, c.req.valid('query')) as never);
  routes.openapi(getRoute, (c) => deps.controller.getById(c, c.req.valid('query').id) as never);
  return routes;
}

export function createAdminPlaceCategoryRoutes(deps: {
  controller: PlaceCategoryController;
  authenticate: MiddlewareHandler<{ Variables: AppVariables }>;
}) {
  const routes = createOpenApiApp();
  routes.use('*', rateLimit({ points: 60, duration: 60 }));
  routes.use('*', deps.authenticate, authorizeRole('root', 'admin', 'reviewer'));

  const listRoute = createRoute({
    method: 'get',
    path: '/',
    tags: ['Admin place categories'],
    summary: 'List kategori place (admin/reviewer)',
    request: { query: listPlaceCategoriesQuerySchema },
    responses: {
      200: { description: 'Daftar kategori', content: json(placeCategoryListResponseSchema) },
      400: { description: 'Query tidak valid', content: json(errorResponseSchema) },
    },
  });

  const createRouteDef = createRoute({
    method: 'post',
    path: '/',
    tags: ['Admin place categories'],
    summary: 'Buat kategori place',
    request: { body: { content: { 'application/json': { schema: createPlaceCategoryBodySchema } } } },
    responses: {
      200: { description: 'Kategori dibuat', content: json(placeCategoryItemResponseSchema) },
      400: { description: 'Body tidak valid', content: json(errorResponseSchema) },
      409: { description: 'Id bentrok', content: json(errorResponseSchema) },
    },
  });

  const updateRoute = createRoute({
    method: 'patch',
    path: '/by-id',
    tags: ['Admin place categories'],
    summary: 'Edit kategori place',
    request: {
      query: placeCategoryIdQuerySchema,
      body: { content: { 'application/json': { schema: updatePlaceCategoryBodySchema } } },
    },
    responses: {
      200: { description: 'Kategori diperbarui', content: json(placeCategoryItemResponseSchema) },
      404: { description: 'Tidak ditemukan', content: json(errorResponseSchema) },
    },
  });

  const deleteRoute = createRoute({
    method: 'delete',
    path: '/by-id',
    tags: ['Admin place categories'],
    summary: 'Soft-delete kategori place',
    request: { query: placeCategoryIdQuerySchema },
    responses: {
      200: { description: 'Terhapus', content: json(okNullResponseSchema) },
      404: { description: 'Tidak ditemukan', content: json(errorResponseSchema) },
      409: { description: 'Masih dipakai place', content: json(errorResponseSchema) },
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
