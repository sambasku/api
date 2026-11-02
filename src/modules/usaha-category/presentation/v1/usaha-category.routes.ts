import type { MiddlewareHandler } from 'hono';
import { createRoute } from '@hono/zod-openapi';
import { z } from 'zod';
import { authorizeRole } from '@/shared/middlewares/authorize-role.middleware';
import { rateLimit } from '@/shared/middlewares/rate-limit.middleware';
import { createOpenApiApp } from '@/shared/openapi/openapi-app';
import { errorResponseSchema, okNullResponseSchema } from '@/shared/openapi/error-response.schema';
import type { AppVariables } from '@/shared/types';
import type { UsahaCategoryController } from './usaha-category.controller';
import {
  createUsahaCategoryBodySchema,
  listUsahaCategoriesQuerySchema,
  usahaCategoryIdQuerySchema,
  usahaCategoryItemResponseSchema,
  usahaCategoryListResponseSchema,
  updateUsahaCategoryBodySchema,
} from './validators/usaha-category.validator';

const json = <T extends z.ZodType>(schema: T) => ({
  'application/json': { schema },
});

export function createPublicUsahaCategoryRoutes(deps: { controller: UsahaCategoryController }) {
  const routes = createOpenApiApp();
  routes.use('*', rateLimit({ points: 120, duration: 60 }));

  const listRoute = createRoute({
    method: 'get',
    path: '/',
    tags: ['Usaha categories'],
    summary: 'List kategori usaha published (publik)',
    request: { query: listUsahaCategoriesQuerySchema },
    responses: {
      200: { description: 'Daftar kategori', content: json(usahaCategoryListResponseSchema) },
      400: { description: 'Query tidak valid', content: json(errorResponseSchema) },
    },
  });

  const getRoute = createRoute({
    method: 'get',
    path: '/by-id',
    tags: ['Usaha categories'],
    summary: 'Detail kategori usaha (publik)',
    request: { query: usahaCategoryIdQuerySchema },
    responses: {
      200: { description: 'Detail kategori', content: json(usahaCategoryItemResponseSchema) },
      404: { description: 'Tidak ditemukan', content: json(errorResponseSchema) },
    },
  });

  routes.openapi(listRoute, (c) => deps.controller.listPublic(c, c.req.valid('query')) as never);
  routes.openapi(getRoute, (c) => deps.controller.getById(c, c.req.valid('query').id) as never);
  return routes;
}

export function createAdminUsahaCategoryRoutes(deps: {
  controller: UsahaCategoryController;
  authenticate: MiddlewareHandler<{ Variables: AppVariables }>;
}) {
  const routes = createOpenApiApp();
  routes.use('*', rateLimit({ points: 60, duration: 60 }));
  routes.use('*', deps.authenticate, authorizeRole('root', 'admin', 'reviewer'));

  const listRoute = createRoute({
    method: 'get',
    path: '/',
    tags: ['Admin usaha categories'],
    summary: 'List kategori usaha (admin/reviewer)',
    request: { query: listUsahaCategoriesQuerySchema },
    responses: {
      200: { description: 'Daftar kategori', content: json(usahaCategoryListResponseSchema) },
      400: { description: 'Query tidak valid', content: json(errorResponseSchema) },
    },
  });

  const createRouteDef = createRoute({
    method: 'post',
    path: '/',
    tags: ['Admin usaha categories'],
    summary: 'Buat kategori usaha',
    request: { body: { content: { 'application/json': { schema: createUsahaCategoryBodySchema } } } },
    responses: {
      200: { description: 'Kategori dibuat', content: json(usahaCategoryItemResponseSchema) },
      400: { description: 'Body tidak valid', content: json(errorResponseSchema) },
      409: { description: 'Id bentrok', content: json(errorResponseSchema) },
    },
  });

  const updateRoute = createRoute({
    method: 'patch',
    path: '/by-id',
    tags: ['Admin usaha categories'],
    summary: 'Edit kategori usaha',
    request: {
      query: usahaCategoryIdQuerySchema,
      body: { content: { 'application/json': { schema: updateUsahaCategoryBodySchema } } },
    },
    responses: {
      200: { description: 'Kategori diperbarui', content: json(usahaCategoryItemResponseSchema) },
      404: { description: 'Tidak ditemukan', content: json(errorResponseSchema) },
    },
  });

  const deleteRoute = createRoute({
    method: 'delete',
    path: '/by-id',
    tags: ['Admin usaha categories'],
    summary: 'Soft-delete kategori usaha',
    request: { query: usahaCategoryIdQuerySchema },
    responses: {
      200: { description: 'Terhapus', content: json(okNullResponseSchema) },
      404: { description: 'Tidak ditemukan', content: json(errorResponseSchema) },
      409: { description: 'Masih dipakai usaha', content: json(errorResponseSchema) },
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
