import type { MiddlewareHandler } from 'hono';
import { createRoute } from '@hono/zod-openapi';
import { z } from 'zod';
import { authorizeRole } from '@/shared/middlewares/authorize-role.middleware';
import { rateLimit } from '@/shared/middlewares/rate-limit.middleware';
import { createOpenApiApp } from '@/shared/openapi/openapi-app';
import { errorResponseSchema, okNullResponseSchema } from '@/shared/openapi/error-response.schema';
import type { AppVariables } from '@/shared/types';
import type { RegionController } from './region.controller';
import {
  createRegionBodySchema,
  listRegionsQuerySchema,
  regionCatalogResponseSchema,
  regionIdQuerySchema,
  regionItemResponseSchema,
  regionListResponseSchema,
  updateRegionBodySchema,
} from './validators/region.validator';

const json = <T extends z.ZodType>(schema: T) => ({
  'application/json': { schema },
});

export function createPublicRegionRoutes(deps: { controller: RegionController }) {
  const routes = createOpenApiApp();
  routes.use('*', rateLimit({ points: 120, duration: 60 }));

  const listRoute = createRoute({
    method: 'get',
    path: '/',
    tags: ['Regions'],
    summary: 'List wilayah published (publik)',
    request: { query: listRegionsQuerySchema },
    responses: {
      200: { description: 'Daftar wilayah', content: json(regionListResponseSchema) },
      400: { description: 'Query tidak valid', content: json(errorResponseSchema) },
    },
  });

  const catalogRoute = createRoute({
    method: 'get',
    path: '/catalog',
    tags: ['Regions'],
    summary: 'Katalog wilayah published untuk peta Eksplorasi (slug, satu response)',
    responses: {
      200: { description: 'Seluruh kecamatan dan desa', content: json(regionCatalogResponseSchema) },
    },
  });

  const getRoute = createRoute({
    method: 'get',
    path: '/by-id',
    tags: ['Regions'],
    summary: 'Detail wilayah by id (ULID)',
    request: { query: regionIdQuerySchema },
    responses: {
      200: { description: 'Detail wilayah', content: json(regionItemResponseSchema) },
      404: { description: 'Tidak ditemukan', content: json(errorResponseSchema) },
    },
  });

  routes.openapi(listRoute, (c) => deps.controller.listPublic(c, c.req.valid('query')) as never);
  routes.openapi(catalogRoute, (c) => deps.controller.catalog(c) as never);
  routes.openapi(getRoute, (c) => deps.controller.getById(c, c.req.valid('query').id) as never);
  return routes;
}

export function createAdminRegionRoutes(deps: {
  controller: RegionController;
  authenticate: MiddlewareHandler<{ Variables: AppVariables }>;
}) {
  const routes = createOpenApiApp();
  routes.use('*', rateLimit({ points: 60, duration: 60 }));
  routes.use('*', deps.authenticate, authorizeRole('root', 'admin', 'reviewer'));

  const listRoute = createRoute({
    method: 'get',
    path: '/',
    tags: ['Admin Regions'],
    summary: 'List wilayah (admin/reviewer, semua status)',
    request: { query: listRegionsQuerySchema },
    responses: {
      200: { description: 'Daftar wilayah', content: json(regionListResponseSchema) },
      400: { description: 'Query tidak valid', content: json(errorResponseSchema) },
    },
  });

  const createRouteDef = createRoute({
    method: 'post',
    path: '/',
    tags: ['Admin Regions'],
    summary: 'Buat wilayah (kecamatan/desa)',
    request: { body: { content: { 'application/json': { schema: createRegionBodySchema } } } },
    responses: {
      200: { description: 'Wilayah dibuat', content: json(regionItemResponseSchema) },
      400: { description: 'Body tidak valid', content: json(errorResponseSchema) },
      409: { description: 'Id bentrok', content: json(errorResponseSchema) },
    },
  });

  const updateRoute = createRoute({
    method: 'patch',
    path: '/by-id',
    tags: ['Admin Regions'],
    summary: 'Edit wilayah',
    request: {
      query: regionIdQuerySchema,
      body: { content: { 'application/json': { schema: updateRegionBodySchema } } },
    },
    responses: {
      200: { description: 'Wilayah diperbarui', content: json(regionItemResponseSchema) },
      404: { description: 'Tidak ditemukan', content: json(errorResponseSchema) },
    },
  });

  const deleteRoute = createRoute({
    method: 'delete',
    path: '/by-id',
    tags: ['Admin Regions'],
    summary: 'Soft-delete wilayah',
    request: { query: regionIdQuerySchema },
    responses: {
      200: { description: 'Terhapus', content: json(okNullResponseSchema) },
      404: { description: 'Tidak ditemukan', content: json(errorResponseSchema) },
      409: { description: 'Masih punya anak atau dipakai place', content: json(errorResponseSchema) },
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
