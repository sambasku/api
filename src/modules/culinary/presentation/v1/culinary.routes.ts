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
import type { CulinaryController } from './culinary.controller';
import {
  createCuisineBodySchema,
  createLinkBodySchema,
  createPlaceBodySchema,
  cuisineListResponseSchema,
  cuisineResponseSchema,
  culinaryCategoryListResponseSchema,
  culinaryPlaceResponseSchema,
  duplicateCandidateListSchema,
  duplicatesQuerySchema,
  listCuisinesQuerySchema,
  listPlacesQuerySchema,
  placeListResponseSchema,
  restrictBodySchema,
  updateCuisineBodySchema,
  updateLinkBodySchema,
  updatePlaceBodySchema,
} from './validators/culinary.validator';

const json = <T extends z.ZodType>(schema: T) => ({
  'application/json': { schema },
});

const idParam = z.object({ id: z.string().min(1).max(64) });
const slugParam = z.object({ slug: z.string().min(1).max(120) });

/**
 * Route publik kuliner. Di-mount di `/api/v1/culinary`.
 * Urutan penting: segmen statis (`/cuisines`, `/places`, `/categories`)
 * didaftarkan sebelum `/:slug` supaya tidak tertelan.
 */
export function createPublicCulinaryRoutes(deps: {
  controller: CulinaryController;
  optionalAuthenticate: MiddlewareHandler<{ Variables: AppVariables }>;
}) {
  const routes = createOpenApiApp();
  routes.use('*', rateLimit({ points: 120, duration: 60 }));
  routes.use('*', deps.optionalAuthenticate);

  const listCuisinesRoute = createRoute({
    method: 'get',
    path: '/cuisines',
    tags: ['Culinary'],
    summary: 'List kuliner published (publik)',
    request: { query: listCuisinesQuerySchema },
    responses: {
      200: { description: 'Daftar kuliner', content: json(cuisineListResponseSchema) },
      400: { description: 'Query tidak valid', content: json(errorResponseSchema) },
    },
  });

  const cuisineDuplicateRoute = createRoute({
    method: 'get',
    path: '/cuisines/duplicates',
    tags: ['Culinary'],
    summary: 'Kandidat kuliner serupa (read-only, tidak memblokir usulan)',
    request: { query: duplicatesQuerySchema },
    responses: {
      200: { description: 'Kandidat duplikat', content: json(duplicateCandidateListSchema) },
    },
  });

  const getCuisineRoute = createRoute({
    method: 'get',
    path: '/cuisines/:slug',
    tags: ['Culinary'],
    summary: 'Detail kuliner by slug + tempat penyedia',
    request: { params: slugParam },
    responses: {
      200: { description: 'Detail kuliner', content: json(cuisineResponseSchema) },
      404: { description: 'Tidak ditemukan', content: json(errorResponseSchema) },
    },
  });

  const listPlacesRoute = createRoute({
    method: 'get',
    path: '/places',
    tags: ['Culinary'],
    summary: 'List tempat/penjual published (publik)',
    request: { query: listPlacesQuerySchema },
    responses: {
      200: { description: 'Daftar tempat', content: json(placeListResponseSchema) },
      400: { description: 'Query tidak valid', content: json(errorResponseSchema) },
    },
  });

  const placeDuplicateRoute = createRoute({
    method: 'get',
    path: '/places/duplicates',
    tags: ['Culinary'],
    summary: 'Kandidat tempat serupa (read-only)',
    request: { query: duplicatesQuerySchema },
    responses: {
      200: { description: 'Kandidat duplikat', content: json(duplicateCandidateListSchema) },
    },
  });

  const getPlaceRoute = createRoute({
    method: 'get',
    path: '/places/:slug',
    tags: ['Culinary'],
    summary: 'Detail tempat/penjual by slug + kuliner yang tersedia',
    request: { params: slugParam },
    responses: {
      200: { description: 'Detail tempat', content: json(culinaryPlaceResponseSchema) },
      404: { description: 'Tidak ditemukan', content: json(errorResponseSchema) },
    },
  });

  const categoriesRoute = createRoute({
    method: 'get',
    path: '/categories',
    tags: ['Culinary'],
    summary: 'Katalog kategori kuliner (publik)',
    responses: {
      200: {
        description: 'Daftar kategori culinary',
        content: json(culinaryCategoryListResponseSchema),
      },
    },
  });

  routes.openapi(listCuisinesRoute, (c) =>
    deps.controller.listCuisines(c, c.req.valid('query')) as never,
  );
  routes.openapi(cuisineDuplicateRoute, (c) =>
    deps.controller.cuisineDuplicates(
      c,
      c.req.valid('query').q,
      c.req.valid('query').exclude_id,
    ) as never,
  );
  routes.openapi(categoriesRoute, (c) =>
    deps.controller.listCategories(c, true) as never,
  );
  routes.openapi(getCuisineRoute, (c) =>
    deps.controller.getCuisine(c, c.req.param('slug')) as never,
  );
  routes.openapi(listPlacesRoute, (c) =>
    deps.controller.listPlaces(c, c.req.valid('query')) as never,
  );
  routes.openapi(placeDuplicateRoute, (c) =>
    deps.controller.placeDuplicates(
      c,
      c.req.valid('query').q,
      c.req.valid('query').exclude_id,
    ) as never,
  );
  routes.openapi(getPlaceRoute, (c) =>
    deps.controller.getPlace(c, c.req.param('slug')) as never,
  );
  return routes;
}

/** Route admin kuliner. Di-mount di `/api/v1/admin/culinary`. */
export function createAdminCulinaryRoutes(deps: {
  controller: CulinaryController;
  authenticate: MiddlewareHandler<{ Variables: AppVariables }>;
}) {
  const routes = createOpenApiApp();
  routes.use('*', rateLimit({ points: 60, duration: 60 }));
  routes.use('*', deps.authenticate, authorizeRole('root', 'admin', 'reviewer'));

  const listCuisinesRoute = createRoute({
    method: 'get',
    path: '/cuisines',
    tags: ['Admin culinary'],
    summary: 'List kuliner (semua status)',
    request: { query: listCuisinesQuerySchema },
    responses: {
      200: { description: 'Daftar kuliner', content: json(cuisineListResponseSchema) },
    },
  });

  const createCuisineRoute = createRoute({
    method: 'post',
    path: '/cuisines',
    tags: ['Admin culinary'],
    summary: 'Buat kuliner langsung (published)',
    request: {
      body: { content: { 'application/json': { schema: createCuisineBodySchema } } },
    },
    responses: {
      200: { description: 'Kuliner dibuat', content: json(cuisineResponseSchema) },
      409: { description: 'Slug bentrok', content: json(errorResponseSchema) },
    },
  });

  const updateCuisineRoute = createRoute({
    method: 'patch',
    path: '/cuisines/:id',
    tags: ['Admin culinary'],
    summary: 'Edit kuliner',
    request: {
      params: idParam,
      body: { content: { 'application/json': { schema: updateCuisineBodySchema } } },
    },
    responses: {
      200: { description: 'Kuliner diperbarui', content: json(cuisineResponseSchema) },
      404: { description: 'Tidak ditemukan', content: json(errorResponseSchema) },
    },
  });

  const deleteCuisineRoute = createRoute({
    method: 'delete',
    path: '/cuisines/:id',
    tags: ['Admin culinary'],
    summary: 'Soft-delete kuliner',
    request: { params: idParam },
    responses: {
      200: { description: 'Terhapus', content: json(okNullResponseSchema) },
      404: { description: 'Tidak ditemukan', content: json(errorResponseSchema) },
    },
  });

  const restrictCuisineRoute = createRoute({
    method: 'post',
    path: '/cuisines/:id/restrict',
    tags: ['Admin culinary'],
    summary: 'Batasi publikasi kuliner (alasan wajib)',
    request: {
      params: idParam,
      body: { content: { 'application/json': { schema: restrictBodySchema } } },
    },
    responses: {
      200: { description: 'Dibatasi', content: json(cuisineResponseSchema) },
    },
  });

  const restoreCuisineRoute = createRoute({
    method: 'post',
    path: '/cuisines/:id/restore',
    tags: ['Admin culinary'],
    summary: 'Pulihkan publikasi kuliner',
    request: { params: idParam },
    responses: {
      200: { description: 'Dipulihkan', content: json(cuisineResponseSchema) },
    },
  });

  const listPlacesRoute = createRoute({
    method: 'get',
    path: '/places',
    tags: ['Admin culinary'],
    summary: 'List tempat/penjual (semua status)',
    request: { query: listPlacesQuerySchema },
    responses: {
      200: { description: 'Daftar tempat', content: json(placeListResponseSchema) },
    },
  });

  const createPlaceRoute = createRoute({
    method: 'post',
    path: '/places',
    tags: ['Admin culinary'],
    summary: 'Buat tempat/penjual langsung (published)',
    request: {
      body: { content: { 'application/json': { schema: createPlaceBodySchema } } },
    },
    responses: {
      200: { description: 'Tempat dibuat', content: json(culinaryPlaceResponseSchema) },
      409: { description: 'Slug bentrok', content: json(errorResponseSchema) },
    },
  });

  const updatePlaceRoute = createRoute({
    method: 'patch',
    path: '/places/:id',
    tags: ['Admin culinary'],
    summary: 'Edit tempat/penjual',
    request: {
      params: idParam,
      body: { content: { 'application/json': { schema: updatePlaceBodySchema } } },
    },
    responses: {
      200: { description: 'Tempat diperbarui', content: json(culinaryPlaceResponseSchema) },
    },
  });

  const deletePlaceRoute = createRoute({
    method: 'delete',
    path: '/places/:id',
    tags: ['Admin culinary'],
    summary: 'Soft-delete tempat/penjual',
    request: { params: idParam },
    responses: {
      200: { description: 'Terhapus', content: json(okNullResponseSchema) },
    },
  });

  const restrictPlaceRoute = createRoute({
    method: 'post',
    path: '/places/:id/restrict',
    tags: ['Admin culinary'],
    summary: 'Batasi publikasi tempat (alasan wajib)',
    request: {
      params: idParam,
      body: { content: { 'application/json': { schema: restrictBodySchema } } },
    },
    responses: {
      200: { description: 'Dibatasi', content: json(culinaryPlaceResponseSchema) },
    },
  });

  const restorePlaceRoute = createRoute({
    method: 'post',
    path: '/places/:id/restore',
    tags: ['Admin culinary'],
    summary: 'Pulihkan publikasi tempat',
    request: { params: idParam },
    responses: {
      200: { description: 'Dipulihkan', content: json(culinaryPlaceResponseSchema) },
    },
  });

  const categoriesRoute = createRoute({
    method: 'get',
    path: '/categories',
    tags: ['Admin culinary'],
    summary: 'Katalog kategori kuliner (semua status)',
    responses: {
      200: {
        description: 'Daftar kategori',
        content: json(culinaryCategoryListResponseSchema),
      },
    },
  });

  // -- relasi (admin only: usulan relasi lewat culinary-contributions) --
  const linkRoute = createRoute({
    method: 'post',
    path: '/links',
    tags: ['Admin culinary'],
    summary: 'Buat relasi kuliner-tempat langsung',
    request: {
      body: { content: { 'application/json': { schema: createLinkBodySchema } } },
    },
    responses: {
      200: { description: 'Relasi dibuat', content: json(z.object({ success: z.literal(true) }).passthrough()) },
      409: { description: 'Relasi sudah ada', content: json(errorResponseSchema) },
    },
  });

  const updateLinkRoute = createRoute({
    method: 'patch',
    path: '/links/:id',
    tags: ['Admin culinary'],
    summary: 'Ubah ketersediaan/catatan relasi',
    request: {
      params: idParam,
      body: { content: { 'application/json': { schema: updateLinkBodySchema } } },
    },
    responses: {
      200: { description: 'Relasi diperbarui', content: json(z.object({ success: z.literal(true) }).passthrough()) },
    },
  });

  const deleteLinkRoute = createRoute({
    method: 'delete',
    path: '/links/:id',
    tags: ['Admin culinary'],
    summary: 'Lepas relasi (entitas tidak ikut terhapus)',
    request: { params: idParam },
    responses: {
      200: { description: 'Relasi dilepas', content: json(okNullResponseSchema) },
    },
  });

  routes.openapi(listCuisinesRoute, (c) =>
    deps.controller.listCuisinesAdmin(c, c.req.valid('query')) as never,
  );
  routes.openapi(createCuisineRoute, (c) =>
    deps.controller.createCuisine(c, c.req.valid('json')) as never,
  );
  routes.openapi(updateCuisineRoute, (c) =>
    deps.controller.updateCuisine(c, c.req.param('id'), c.req.valid('json')) as never,
  );
  routes.openapi(deleteCuisineRoute, (c) =>
    deps.controller.deleteCuisine(c, c.req.param('id')) as never,
  );
  routes.openapi(restrictCuisineRoute, (c) =>
    deps.controller.restrictCuisine(c, c.req.param('id'), c.req.valid('json').reason) as never,
  );
  routes.openapi(restoreCuisineRoute, (c) =>
    deps.controller.restoreCuisine(c, c.req.param('id')) as never,
  );
  routes.openapi(listPlacesRoute, (c) =>
    deps.controller.listPlacesAdmin(c, c.req.valid('query')) as never,
  );
  routes.openapi(createPlaceRoute, (c) =>
    deps.controller.createPlace(c, c.req.valid('json')) as never,
  );
  routes.openapi(updatePlaceRoute, (c) =>
    deps.controller.updatePlace(c, c.req.param('id'), c.req.valid('json')) as never,
  );
  routes.openapi(deletePlaceRoute, (c) =>
    deps.controller.deletePlace(c, c.req.param('id')) as never,
  );
  routes.openapi(restrictPlaceRoute, (c) =>
    deps.controller.restrictPlace(c, c.req.param('id'), c.req.valid('json').reason) as never,
  );
  routes.openapi(restorePlaceRoute, (c) =>
    deps.controller.restorePlace(c, c.req.param('id')) as never,
  );
  routes.openapi(categoriesRoute, (c) =>
    deps.controller.listCategories(c, false) as never,
  );
  routes.openapi(linkRoute, (c) =>
    deps.controller.createLink(c, c.req.valid('json')) as never,
  );
  routes.openapi(updateLinkRoute, (c) =>
    deps.controller.updateLink(c, c.req.param('id'), c.req.valid('json')) as never,
  );
  routes.openapi(deleteLinkRoute, (c) =>
    deps.controller.deleteLink(c, c.req.param('id')) as never,
  );
  return routes;
}
