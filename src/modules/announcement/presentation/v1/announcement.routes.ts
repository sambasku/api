import type { MiddlewareHandler } from 'hono';
import { createRoute } from '@hono/zod-openapi';
import { z } from 'zod';
import { authorizeRole } from '@/shared/middlewares/authorize-role.middleware';
import { rateLimit } from '@/shared/middlewares/rate-limit.middleware';
import { createOpenApiApp } from '@/shared/openapi/openapi-app';
import { errorResponseSchema, okNullResponseSchema } from '@/shared/openapi/error-response.schema';
import type { AppVariables } from '@/shared/types';
import type { AnnouncementController } from './announcement.controller';
import {
  announcementItemResponseSchema,
  announcementListResponseSchema,
  createAnnouncementBodySchema,
  listAnnouncementsQuerySchema,
  updateAnnouncementBodySchema,
} from './validators/announcement.validator';

const json = <T extends z.ZodType>(schema: T) => ({
  'application/json': { schema },
});

export interface AnnouncementRoutesDeps {
  controller: AnnouncementController;
  authenticate: MiddlewareHandler<{ Variables: AppVariables }>;
}

// Admin Pengumuman (#102): CRUD + write-through feed `announcement`.
// Gate: root|admin (keputusan issue - reviewer/editor tidak boleh).
export function createAdminAnnouncementRoutes(deps: AnnouncementRoutesDeps) {
  const routes = createOpenApiApp();

  routes.use('*', rateLimit({ points: 60, duration: 60 }));

  const idParam = z.object({ id: z.string().length(26) });

  const listRoute = createRoute({
    method: 'get',
    path: '/',
    tags: ['Admin Announcements'],
    summary: 'List pengumuman (keyset, terbaru dulu)',
    request: { query: listAnnouncementsQuerySchema },
    responses: {
      200: { description: 'Daftar pengumuman', content: json(announcementListResponseSchema) },
      400: { description: 'Query tidak valid', content: json(errorResponseSchema) },
    },
  });

  const defineRoute = createRoute({
    method: 'post',
    path: '/',
    tags: ['Admin Announcements'],
    summary: 'Buat pengumuman - tayang di feed publik (write-through event)',
    request: { body: { content: { 'application/json': { schema: createAnnouncementBodySchema } } } },
    responses: {
      200: { description: 'Pengumuman dibuat', content: json(announcementItemResponseSchema) },
      400: { description: 'Body tidak valid', content: json(errorResponseSchema) },
    },
  });

  const updateRoute = createRoute({
    method: 'patch',
    path: '/:id',
    tags: ['Admin Announcements'],
    summary: 'Edit pengumuman - refresh copy beku di feed',
    request: {
      params: idParam,
      body: { content: { 'application/json': { schema: updateAnnouncementBodySchema } } },
    },
    responses: {
      200: { announcement: undefined, description: 'Pengumuman diperbarui', content: json(announcementItemResponseSchema) },
      400: { description: 'Body tidak valid', content: json(errorResponseSchema) },
      404: { description: 'Tidak ditemukan', content: json(errorResponseSchema) },
    },
  });

  const deleteRoute = createRoute({
    method: 'delete',
    path: '/:id',
    tags: ['Admin Announcements'],
    summary: 'Hapus pengumuman - hilang dari feed',
    request: { params: idParam },
    responses: {
      200: { description: 'Terhapus', content: json(okNullResponseSchema) },
      404: { description: 'Tidak ditemukan',  content: json(errorResponseSchema) },
    },
  });

  routes.use('*', deps.authenticate, authorizeRole('root', 'admin'));
  routes.openapi(listRoute, (c) => deps.controller.listAnnouncements(c, c.req.valid('query')) as never);
  routes.openapi(defineRoute, (c) => deps.controller.createAnnouncement(c, c.req.valid('json')) as never);
  routes.openapi(updateRoute, (c) => deps.controller.updateAnnouncement(c, c.req.param('id'), c.req.valid('json')) as never);
  routes.openapi(deleteRoute, (c) => deps.controller.deleteAnnouncement(c, c.req.param('id')) as never);

  return routes;
}

// Publik (#102 deep link): detail pengumuman tanpa auth - soft-delete 404,
// kadaluarsa 200 + expired=true (konsisten feed).
export function createPublicAnnouncementRoutes(deps: { controller: AnnouncementController }) {
  const routes = createOpenApiApp();

  routes.use('*', rateLimit({ points: 60, duration: 60 }));

  const getRoute = createRoute({
    method: 'get',
    path: '/:id',
    tags: ['Announcements'],
    summary: 'Detail pengumuman (publik, deep link)',
    request: { params: z.object({ id: z.string().length(26) }) },
    responses: {
      200: { description: 'Detail pengumuman', content: json(announcementItemResponseSchema) },
      404: { description: 'Tidak ditemukan', content: json(errorResponseSchema) },
    },
  });

  const listPinnedRoute = createRoute({
    method: 'get',
    path: '/pinned',
    tags: ['Announcements'],
    summary: 'Daftar pengumuman yang dipin (mobile carousel / halaman pinned)',
    responses: {
      200: { description: 'Daftar pengumuman pinned', content: json(announcementListResponseSchema) },
    },
  });

  // /pinned wajib didaftarkan SEBELUM /:id: Hono match urutan registrasi,
  // kalau tidak /pinned nyangkut di /:id (id="pinned" → 400).
  routes.openapi(listPinnedRoute, (c) => deps.controller.listPinnedAnnouncements(c) as never);
  routes.openapi(getRoute, (c) => deps.controller.getAnnouncement(c, c.req.param('id')) as never);

  return routes;
}
