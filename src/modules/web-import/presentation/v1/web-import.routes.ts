import type { MiddlewareHandler } from 'hono';
import { createRoute } from '@hono/zod-openapi';
import { z } from 'zod';
import { authorizeRole } from '@/shared/middlewares/authorize-role.middleware';
import { rateLimit } from '@/shared/middlewares/rate-limit.middleware';
import { createOpenApiApp } from '@/shared/openapi/openapi-app';
import { errorResponseSchema } from '@/shared/openapi/error-response.schema';
import type { AppVariables } from '@/shared/types';
import type { WebImportController } from './web-import.controller';
import {
  approveWebImportBodySchema,
  listWebImportsQuerySchema,
  previewWebImportQuerySchema,
  rejectWebImportBodySchema,
  submitWebImportBodySchema,
  webImportDetailResponseSchema,
  webImportListResponseSchema,
  webImportPreviewResponseSchema,
  webImportResponseSchema,
  webImportSubmitResponseSchema,
  webImportIdParamSchema,
} from './validators/web-import.validator';

const json = <T extends z.ZodType>(schema: T) => ({
  'application/json': { schema },
});

export function createPublicWebImportRoutes(deps: { controller: WebImportController }) {
  const routes = createOpenApiApp();
  // Publik: 20 submit/jam per IP
  routes.use('*', rateLimit({ points: 20, duration: 3600 }));

  const submitRoute = createRoute({
    method: 'post',
    path: '/',
    tags: ['Web imports'],
    summary: 'Submit pengajuan impor lemma (publik, tanpa login)',
    request: { body: { content: json(submitWebImportBodySchema) } },
    responses: {
      201: { description: 'Pengajuan diterima', content: json(webImportSubmitResponseSchema) },
      400: { description: 'Body tidak valid', content: json(errorResponseSchema) },
      429: { description: 'Rate limit terlampaui', content: json(errorResponseSchema) },
    },
  });

  routes.openapi(submitRoute, (c) => deps.controller.submit(c, c.req.valid('json')) as never);
  return routes;
}

export function createAdminWebImportRoutes(deps: {
  controller: WebImportController;
  authenticate: MiddlewareHandler<{ Variables: AppVariables }>;
}) {
  const routes = createOpenApiApp();

  const admin = [
    deps.authenticate,
    authorizeRole('root', 'admin', 'reviewer'),
    rateLimit({ points: 500, duration: 60 }),
  ] as const;

  routes.use('/', ...admin);
  routes.use('/:id', ...admin);
  routes.use('/:id/preview', ...admin);
  routes.use('/:id/approve', ...admin);
  routes.use('/:id/reject', ...admin);

  const listRoute = createRoute({
    method: 'get',
    path: '/',
    tags: ['Web imports', 'Admin'],
    summary: 'Daftar pengajuan impor web (admin/root/reviewer, cursor)',
    request: { query: listWebImportsQuerySchema },
    responses: {
      200: { description: 'Daftar pengajuan', content: json(webImportListResponseSchema) },
      401: { description: 'Token tidak ada/invalid', content: json(errorResponseSchema) },
      403: { description: 'Bukan admin/root/reviewer', content: json(errorResponseSchema) },
    },
  });

  const detailRoute = createRoute({
    method: 'get',
    path: '/:id',
    tags: ['Web imports', 'Admin'],
    summary: 'Detail pengajuan impor web',
    request: { params: webImportIdParamSchema },
    responses: {
      200: { description: 'Detail pengajuan', content: json(webImportResponseSchema) },
      401: { description: 'Token tidak ada/invalid', content: json(errorResponseSchema) },
      403: { description: 'Bukan admin/root/reviewer', content: json(errorResponseSchema) },
      404: { description: 'Pengajuan tidak ditemukan', content: json(errorResponseSchema) },
    },
  });

  const previewRoute = createRoute({
    method: 'get',
    path: '/:id/preview',
    tags: ['Web imports', 'Admin'],
    summary: 'Preview baris pengajuan impor web',
    request: { params: webImportIdParamSchema, query: previewWebImportQuerySchema },
    responses: {
      200: { description: 'Preview baris', content: json(webImportPreviewResponseSchema) },
      401: { description: 'Token tidak ada/invalid', content: json(errorResponseSchema) },
      403: { description: 'Bukan admin/root/reviewer', content: json(errorResponseSchema) },
      404: { description: 'Pengajuan tidak ditemukan', content: json(errorResponseSchema) },
    },
  });

  const approveRoute = createRoute({
    method: 'post',
    path: '/:id/approve',
    tags: ['Web imports', 'Admin'],
    summary: 'Setujui pengajuan impor web',
    request: {
      params: webImportIdParamSchema,
      body: { content: json(approveWebImportBodySchema) },
    },
    responses: {
      200: { description: 'Disetujui', content: json(webImportResponseSchema) },
      401: { description: 'Token tidak ada/invalid', content: json(errorResponseSchema) },
      403: { description: 'Bukan admin/root/reviewer', content: json(errorResponseSchema) },
      404: { description: 'Pengajuan tidak ditemukan', content: json(errorResponseSchema) },
      409: { description: 'Bukan pending_review', content: json(errorResponseSchema) },
    },
  });

  const rejectRoute = createRoute({
    method: 'post',
    path: '/:id/reject',
    tags: ['Web imports', 'Admin'],
    summary: 'Tolak pengajuan impor web (note wajib)',
    request: {
      params: webImportIdParamSchema,
      body: { content: json(rejectWebImportBodySchema) },
    },
    responses: {
      200: { description: 'Ditolak', content: json(webImportResponseSchema) },
      400: { description: 'Note wajib', content: json(errorResponseSchema) },
      401: { description: 'Token tidak ada/invalid', content: json(errorResponseSchema) },
      403: { description: 'Bukan admin/root/reviewer', content: json(errorResponseSchema) },
      404: { description: 'Pengajuan tidak ditemukan', content: json(errorResponseSchema) },
      409: { description: 'Bukan pending_review', content: json(errorResponseSchema) },
    },
  });

  routes.openapi(listRoute, (c) => deps.controller.list(c, c.req.valid('query')) as never);
  routes.openapi(detailRoute, (c) => deps.controller.getById(c, c.req.param('id')) as never);
  routes.openapi(previewRoute, (c) =>
    deps.controller.preview(c, c.req.param('id'), c.req.valid('query')) as never,
  );
  routes.openapi(approveRoute, (c) =>
    deps.controller.approve(c, c.req.param('id'), c.req.valid('json')) as never,
  );
  routes.openapi(rejectRoute, (c) =>
    deps.controller.reject(c, c.req.param('id'), c.req.valid('json')) as never,
  );

  return routes;
}
