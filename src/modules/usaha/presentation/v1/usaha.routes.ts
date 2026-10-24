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
import type { UsahaController } from './usaha.controller';
import {
  createUsahaBodySchema,
  listUsahasQuerySchema,
  listUsahasResponseSchema,
  restrictUsahaBodySchema,
  updateUsahaBodySchema,
  usahaCategoryListResponseSchema,
  usahaResponseSchema,
} from './validators/usaha.validator';

const json = <T extends z.ZodType>(schema: T) => ({
  'application/json': { schema },
});

const idParam = z.object({ id: z.string().min(1).max(64) });
const slugParam = z.object({ slug: z.string().min(1).max(120) });

export function createPublicUsahaRoutes(deps: {
  controller: UsahaController;
  optionalAuthenticate: MiddlewareHandler<{ Variables: AppVariables }>;
}) {
  const routes = createOpenApiApp();
  routes.use('*', rateLimit({ points: 120, duration: 60 }));
  routes.use('*', deps.optionalAuthenticate);

  const listRoute = createRoute({
    method: 'get',
    path: '/',
    tags: ['Usaha'],
    summary: 'List usaha published (publik)',
    request: { query: listUsahasQuerySchema },
    responses: {
      200: { description: 'Daftar usaha', content: json(listUsahasResponseSchema) },
      400: { description: 'Query tidak valid', content: json(errorResponseSchema) },
    },
  });

  const categoriesRoute = createRoute({
    method: 'get',
    path: '/categories',
    tags: ['Usaha'],
    summary: 'Katalog kategori usaha (publik)',
    responses: {
      200: {
        description: 'Daftar kategori usaha',
        content: json(usahaCategoryListResponseSchema),
      },
    },
  });

  const getRoute = createRoute({
    method: 'get',
    path: '/:slug',
    tags: ['Usaha'],
    summary: 'Detail usaha by slug (publik)',
    request: { params: slugParam },
    responses: {
      200: { description: 'Detail usaha', content: json(usahaResponseSchema) },
      404: { description: 'Tidak ditemukan', content: json(errorResponseSchema) },
    },
  });

  routes.openapi(listRoute, (c) =>
    deps.controller.listPublic(c, c.req.valid('query')) as never,
  );
  // `/categories` HARUS sebelum `/:slug` - Hono cocokkan sesuai urutan
  // registrasi, slug param akan menelan "categories" kalau belakangan.
  routes.openapi(categoriesRoute, (c) =>
    deps.controller.listCategories(c, true) as never,
  );
  routes.openapi(getRoute, (c) =>
    deps.controller.getBySlug(c, c.req.param('slug')) as never,
  );
  return routes;
}

export function createAdminUsahaRoutes(deps: {
  controller: UsahaController;
  authenticate: MiddlewareHandler<{ Variables: AppVariables }>;
}) {
  const routes = createOpenApiApp();
  routes.use('*', rateLimit({ points: 60, duration: 60 }));
  routes.use('*', deps.authenticate, authorizeRole('root', 'admin', 'reviewer'));

  const listRoute = createRoute({
    method: 'get',
    path: '/',
    tags: ['Admin Usaha'],
    summary: 'List usaha (semua status)',
    request: { query: listUsahasQuerySchema },
    responses: {
      200: { description: 'Daftar usaha', content: json(listUsahasResponseSchema) },
      400: { description: 'Query tidak valid', content: json(errorResponseSchema) },
    },
  });

  const categoriesRoute = createRoute({
    method: 'get',
    path: '/categories',
    tags: ['Admin Usaha'],
    summary: 'Katalog kategori usaha (admin)',
    responses: {
      200: {
        description: 'Daftar kategori',
        content: json(usahaCategoryListResponseSchema),
      },
    },
  });

  const createRouteDef = createRoute({
    method: 'post',
    path: '/',
    tags: ['Admin Usaha'],
    summary: 'Buat usaha',
    request: {
      body: { content: { 'application/json': { schema: createUsahaBodySchema } } },
    },
    responses: {
      200: { description: 'Usaha dibuat', content: json(usahaResponseSchema) },
      400: { description: 'Body tidak valid', content: json(errorResponseSchema) },
      409: { description: 'Slug bentrok', content: json(errorResponseSchema) },
    },
  });

  const updateRoute = createRoute({
    method: 'patch',
    path: '/:id',
    tags: ['Admin Usaha'],
    summary: 'Edit usaha',
    request: {
      params: idParam,
      body: { content: { 'application/json': { schema: updateUsahaBodySchema } } },
    },
    responses: {
      200: { description: 'Usaha diperbarui', content: json(usahaResponseSchema) },
      404: { description: 'Tidak ditemukan', content: json(errorResponseSchema) },
      409: { description: 'Slug bentrok', content: json(errorResponseSchema) },
    },
  });

  const deleteRoute = createRoute({
    method: 'delete',
    path: '/:id',
    tags: ['Admin Usaha'],
    summary: 'Soft-delete usaha',
    request: { params: idParam },
    responses: {
      200: { description: 'Terhapus', content: json(okNullResponseSchema) },
      404: { description: 'Tidak ditemukan', content: json(errorResponseSchema) },
    },
  });

  const restrictRoute = createRoute({
    method: 'post',
    path: '/:id/restrict',
    tags: ['Admin Usaha'],
    summary: 'Batasi publikasi sementara (alasan wajib)',
    request: {
      params: idParam,
      body: { content: { 'application/json': { schema: restrictUsahaBodySchema } } },
    },
    responses: {
      200: { description: 'Dibatasi', content: json(usahaResponseSchema) },
      404: { description: 'Tidak ditemukan', content: json(errorResponseSchema) },
    },
  });

  const restoreRoute = createRoute({
    method: 'post',
    path: '/:id/restore',
    tags: ['Admin Usaha'],
    summary: 'Pulihkan publikasi (archived/restricted -> published)',
    request: { params: idParam },
    responses: {
      200: { description: 'Dipulihkan', content: json(usahaResponseSchema) },
      404: { description: 'Tidak ditemukan', content: json(errorResponseSchema) },
    },
  });

  const duplicatesRoute = createRoute({
    method: 'get',
    path: '/:id/duplicates',
    tags: ['Admin Usaha'],
    summary: 'Saran dugaan duplikat (read-only, tidak merge otomatis)',
    request: { params: idParam },
    responses: {
      200: { description: 'Kandidat duplikat', content: json(z.object({ success: z.literal(true) }).passthrough()) },
      404: { description: 'Tidak ditemukan', content: json(errorResponseSchema) },
    },
  });

  routes.openapi(listRoute, (c) =>
    deps.controller.listAdmin(c, c.req.valid('query')) as never,
  );
  routes.openapi(categoriesRoute, (c) =>
    deps.controller.listCategories(c, false) as never,
  );
  routes.openapi(createRouteDef, (c) =>
    deps.controller.create(c, c.req.valid('json')) as never,
  );
  routes.openapi(updateRoute, (c) =>
    deps.controller.update(c, c.req.param('id'), c.req.valid('json')) as never,
  );
  routes.openapi(deleteRoute, (c) =>
    deps.controller.remove(c, c.req.param('id')) as never,
  );
  routes.openapi(restrictRoute, (c) =>
    deps.controller.restrict(c, c.req.param('id'), c.req.valid('json').reason) as never,
  );
  routes.openapi(restoreRoute, (c) =>
    deps.controller.restore(c, c.req.param('id')) as never,
  );
  routes.openapi(duplicatesRoute, (c) =>
    deps.controller.duplicates(c, c.req.param('id')) as never,
  );
  return routes;
}
