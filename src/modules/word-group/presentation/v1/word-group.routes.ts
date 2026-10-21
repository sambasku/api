import { createRoute } from '@hono/zod-openapi';
import { rateLimit } from '@/shared/middlewares/rate-limit.middleware';
import { createOpenApiApp } from '@/shared/openapi/openapi-app';
import { errorResponseSchema, okNullResponseSchema } from '@/shared/openapi/error-response.schema';
import type { AppVariables } from '@/shared/types';
import type { WordGroupController } from './word-group.controller';
import {
  addWordGroupMemberBodySchema,
  listWordGroupsQuerySchema,
  removeWordGroupMemberQuerySchema,
  updateWordGroupBodySchema,
  wordGroupItemResponseSchema,
  wordGroupListResponseSchema,
  createWordGroupBodySchema,
  wordGroupIdQuerySchema,
} from './validators/word-group.validator';

const json = <T extends import('zod').ZodType>(schema: T) => ({
  'application/json': { schema },
});

/**
 * PRD relasi-lemma: kelompok makna (makna sama/berdekatan).
 * Publik: GET list + by-id (published saja).
 * Auth (contributor+): kelola kelompok & anggota; verifikasi status
 * 'published' hanya efektif untuk role verifikator (lihat controller).
 */
export function createWordGroupRoutes(deps: {
  controller: WordGroupController;
  authenticate: import('hono').MiddlewareHandler<{ Variables: AppVariables }>;
}) {
  const routes = createOpenApiApp();
  routes.use('*', rateLimit({ points: 120, duration: 60 }));

  // ---- Publik (tanpa auth) ----
  const publicList = createRoute({
    method: 'get',
    path: '/',
    tags: ['Word groups'],
    summary: 'Daftar kelompok makna published (publik)',
    request: { query: listWordGroupsQuerySchema },
    responses: {
      200: { description: 'Daftar kelompok', content: json(wordGroupListResponseSchema) },
      400: { description: 'Query tidak valid', content: json(errorResponseSchema) },
    },
  });
  const publicGet = createRoute({
    method: 'get',
    path: '/by-id',
    tags: ['Word groups'],
    summary: 'Detail kelompok makna published (publik)',
    request: { query: wordGroupIdQuerySchema },
    responses: {
      200: { description: 'Detail kelompok', content: json(wordGroupItemResponseSchema) },
      404: { description: 'Tidak ditemukan', content: json(errorResponseSchema) },
    },
  });
  routes.openapi(publicList, (c) => deps.controller.listPublic(c, c.req.valid('query')) as never);
  routes.openapi(publicGet, (c) => deps.controller.getByIdPublic(c, c.req.valid('query').id) as never);

  // ---- Auth (contributor ke atas) ----
  routes.use('*', deps.authenticate);

  const listRoute = createRoute({
    method: 'get',
    path: '/all',
    tags: ['Word groups'],
    summary: 'Daftar kelompok makna semua status (admin/review)',
    request: { query: listWordGroupsQuerySchema },
    responses: {
      200: { description: 'Daftar kelompok', content: json(wordGroupListResponseSchema) },
      401: { description: 'Belum login', content: json(errorResponseSchema) },
    },
  });
  const getRoute = createRoute({
    method: 'get',
    path: '/all/by-id',
    tags: ['Word groups'],
    summary: 'Detail kelompok makna semua status (admin/review)',
    request: { query: wordGroupIdQuerySchema },
    responses: {
      200: { description: 'Detail kelompok', content: json(wordGroupItemResponseSchema) },
      401: { description: 'Belum login', content: json(errorResponseSchema) },
      404: { description: 'Tidak ditemukan', content: json(errorResponseSchema) },
    },
  });
  const createGroupRoute = createRoute({
    method: 'post',
    path: '/',
    tags: ['Word groups'],
    summary: 'Buat kelompok makna',
    request: { body: { content: { 'application/json': { schema: createWordGroupBodySchema } } } },
    responses: {
      200: { description: 'Kelompok dibuat', content: json(wordGroupItemResponseSchema) },
      400: { description: 'Body tidak valid', content: json(errorResponseSchema) },
      401: { description: 'Belum login', content: json(errorResponseSchema) },
    },
  });
  const updateRoute = createRoute({
    method: 'patch',
    path: '/by-id',
    tags: ['Word groups'],
    summary: 'Edit kelompok makna (nama/deskripsi/status)',
    request: {
      query: wordGroupIdQuerySchema,
      body: { content: { 'application/json': { schema: updateWordGroupBodySchema } } },
    },
    responses: {
      200: { description: 'Kelompok diperbarui', content: json(wordGroupItemResponseSchema) },
      400: { description: 'Body tidak valid', content: json(errorResponseSchema) },
      404: { description: 'Tidak ditemukan', content: json(errorResponseSchema) },
    },
  });
  const deleteRoute = createRoute({
    method: 'delete',
    path: '/by-id',
    tags: ['Word groups'],
    summary: 'Soft-delete kelompok makna',
    request: { query: wordGroupIdQuerySchema },
    responses: {
      200: { description: 'Terhapus', content: json(okNullResponseSchema) },
      404: { description: 'Tidak ditemukan', content: json(errorResponseSchema) },
    },
  });
  const addMemberRoute = createRoute({
    method: 'post',
    path: '/by-id/members',
    tags: ['Word groups'],
    summary: 'Tambah anggota ke kelompok makna',
    request: {
      query: wordGroupIdQuerySchema,
      body: { content: { 'application/json': { schema: addWordGroupMemberBodySchema } } },
    },
    responses: {
      200: { description: 'Anggota ditambahkan', content: json(wordGroupItemResponseSchema) },
      400: { description: 'Body tidak valid', content: json(errorResponseSchema) },
      404: { description: 'Tidak ditemukan', content: json(errorResponseSchema) },
      409: { description: 'Sudah anggota', content: json(errorResponseSchema) },
    },
  });
  const removeMemberRoute = createRoute({
    method: 'delete',
    path: '/by-id/members',
    tags: ['Word groups'],
    summary: 'Keluarkan anggota dari kelompok makna',
    request: { query: removeWordGroupMemberQuerySchema },
    responses: {
      200: { description: 'Anggota dikeluarkan', content: json(okNullResponseSchema) },
      404: { description: 'Tidak ditemukan', content: json(errorResponseSchema) },
    },
  });

  routes.openapi(listRoute, (c) => deps.controller.listAdmin(c, c.req.valid('query')) as never);
  routes.openapi(getRoute, (c) => deps.controller.getByIdAdmin(c, c.req.valid('query').id) as never);
  routes.openapi(createGroupRoute, (c) => deps.controller.create(c, c.req.valid('json')) as never);
  routes.openapi(updateRoute, (c) =>
    deps.controller.update(c, c.req.valid('query').id, c.req.valid('json')) as never,
  );
  routes.openapi(deleteRoute, (c) => deps.controller.remove(c, c.req.valid('query').id) as never);
  routes.openapi(addMemberRoute, (c) =>
    deps.controller.addMember(c, c.req.valid('query').id, c.req.valid('json')) as never,
  );
  routes.openapi(removeMemberRoute, (c) =>
    deps.controller.removeMember(c, c.req.valid('query')) as never,
  );
  return routes;
}
