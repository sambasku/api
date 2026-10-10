import type { MiddlewareHandler } from 'hono';
import { createRoute } from '@hono/zod-openapi';
import { z } from 'zod';
import { authorizeRole } from '@/shared/middlewares/authorize-role.middleware';
import { rateLimit } from '@/shared/middlewares/rate-limit.middleware';
import { createOpenApiApp } from '@/shared/openapi/openapi-app';
import { errorResponseSchema, okNullResponseSchema } from '@/shared/openapi/error-response.schema';
import type { AppVariables } from '@/shared/types';
import type { CategoryController } from './category.controller';

const json = <T extends z.ZodType>(schema: T) => ({
  'application/json': { schema },
});

const categoryItemSchema = z.object({
  id: z.string(),
  parent_id: z.string().nullable(),
  name: z.string(),
  description: z.string().nullable(),
  word_count: z.number(),
});

const categoryListResponseSchema = z.object({
  success: z.literal(true),
  data: z.array(categoryItemSchema),
});

const categoryItemResponseSchema = z.object({
  success: z.literal(true),
  data: categoryItemSchema,
});

export const createCategoryBodySchema = z.object({
  name: z.string().min(1).max(60),
  description: z.string().nullable().optional(),
  parent_id: z.string().nullable().optional(),
});

export const updateCategoryBodySchema = z.object({
  name: z.string().min(1).max(60).optional(),
  description: z.string().nullable().optional(),
  parent_id: z.string().nullable().optional(),
});

const idParam = z.object({ id: z.string() });

export interface CategoryRoutesDeps {
  controller: CategoryController;
  authenticate: MiddlewareHandler<{ Variables: AppVariables }>;
}

// GET /api/v1/categories - multi-select kategori form admin (publik baca)
// POST/PUT/DELETE - master kategori keur (admin)
export function createCategoryRoutes(deps: CategoryRoutesDeps) {
  const routes = createOpenApiApp();
  routes.use('*', rateLimit({ points: 100, duration: 60 })); // publik baca (Section 15)

  const listRoute = createRoute({
    method: 'get',
    path: '/',
    tags: ['Categories'],
    summary: 'Daftar kategori/glosarium (multi-select form admin)',
    responses: {
      200: { description: 'Daftar kategori', content: json(categoryListResponseSchema) },
    },
  });

  const createRouteDef = createRoute({
    method: 'post',
    path: '/',
    tags: ['Categories'],
    summary: 'Buat kategori master',
    request: { body: { content: { 'application/json': { schema: createCategoryBodySchema } } } },
    responses: {
      201: { description: 'Kategori dibuat', content: json(categoryItemResponseSchema) },
      400: { description: 'Body tidak valid', content: json(errorResponseSchema) },
    },
  });

  const updateRouteDef = createRoute({
    method: 'put',
    path: '/:id',
    tags: ['Categories'],
    summary: 'Edit kategori master',
    request: {
      params: idParam,
      body: { content: { 'application/json': { schema: updateCategoryBodySchema } } },
    },
    responses: {
      200: { description: 'Kategori diperbarui', content: json(categoryItemResponseSchema) },
      400: { description: 'Body tidak valid', content: json(errorResponseSchema) },
      404: { description: 'Tidak ditemukan', content: json(errorResponseSchema) },
    },
  });

  const deleteRouteDef = createRoute({
    method: 'delete',
    path: '/:id',
    tags: ['Categories'],
    summary: 'Hapus kategori master (soft delete)',
    request: { params: idParam },
    responses: {
      200: { description: 'Terhapus', content: json(okNullResponseSchema) },
      404: { description: 'Tidak ditemukan', content: json(errorResponseSchema) },
    },
  });

  routes.openapi(listRoute, (c) => deps.controller.categories(c) as never);

  // Mutasi master kategori: wajib auth + root|admin (keputusan issue -
  // reviewer/editor tidak boleh edit master data).
  routes.use('*', deps.authenticate, authorizeRole('root', 'admin'));
  routes.openapi(createRouteDef, (c) => deps.controller.createCategory(c, c.req.valid('json')) as never);
  routes.openapi(updateRouteDef, (c) => deps.controller.updateCategory(c, c.req.param('id'), c.req.valid('json')) as never);
  routes.openapi(deleteRouteDef, (c) => deps.controller.deleteCategory(c, c.req.param('id')) as never);

  return routes;
}