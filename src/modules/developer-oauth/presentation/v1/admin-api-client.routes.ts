import type { MiddlewareHandler } from 'hono';
import { createRoute } from '@hono/zod-openapi';
import { authorizeRole } from '@/shared/middlewares/authorize-role.middleware';
import { rateLimit } from '@/shared/middlewares/rate-limit.middleware';
import { createOpenApiApp } from '@/shared/openapi/openapi-app';
import { errorResponseSchema } from '@/shared/openapi/error-response.schema';
import type { AppVariables } from '@/shared/types';
import type { AdminApiClientController } from './admin-api-client.controller';
import {
  apiClientAdminListResponseSchema,
  apiClientAdminResponseSchema,
  apiClientIdParamsSchema,
  createAdminApiClientBodySchema,
  listAdminApiClientsQuerySchema,
  updateAdminApiClientBodySchema,
} from './validators/api-client.validator';

const json = <T extends import('zod').ZodType>(schema: T) => ({
  'application/json': { schema },
});

export interface AdminApiClientRoutesDeps {
  controller: AdminApiClientController;
  authenticate: MiddlewareHandler<{ Variables: AppVariables }>;
}

/** CRUD admin api_clients - mount di /api/v1/admin/api-clients */
export function createAdminApiClientRoutes(deps: AdminApiClientRoutesDeps) {
  const routes = createOpenApiApp();

  routes.use(
    '*',
    deps.authenticate,
    authorizeRole('admin', 'root'),
    rateLimit({ points: 60, duration: 60 }),
  );

  routes.openapi(
    createRoute({
      method: 'get',
      path: '/',
      tags: ['Admin API Clients'],
      summary: 'Daftar api_clients (first-party + third-party)',
      request: { query: listAdminApiClientsQuerySchema },
      responses: {
        200: { description: 'Daftar klien', content: json(apiClientAdminListResponseSchema) },
        401: { description: 'Tidak terautentikasi', content: json(errorResponseSchema) },
        403: { description: 'Bukan admin/root', content: json(errorResponseSchema) },
      },
    }),
    (c) => deps.controller.list(c, c.req.valid('query')) as never,
  );

  routes.openapi(
    createRoute({
      method: 'get',
      path: '/{id}',
      tags: ['Admin API Clients'],
      summary: 'Detail satu api_client',
      request: { params: apiClientIdParamsSchema },
      responses: {
        200: { description: 'Detail', content: json(apiClientAdminResponseSchema) },
        404: { description: 'Tidak ditemukan', content: json(errorResponseSchema) },
      },
    }),
    (c) => deps.controller.get(c, c.req.valid('param').id) as never,
  );

  routes.openapi(
    createRoute({
      method: 'post',
      path: '/',
      tags: ['Admin API Clients'],
      summary: 'Buat klien third-party (bukan first-party)',
      request: { body: { content: json(createAdminApiClientBodySchema) } },
      responses: {
        201: { description: 'Dibuat', content: json(apiClientAdminResponseSchema) },
        400: { description: 'Validasi gagal', content: json(errorResponseSchema) },
        409: { description: 'client_id bentrok', content: json(errorResponseSchema) },
      },
    }),
    (c) => deps.controller.create(c, c.req.valid('json')) as never,
  );

  routes.openapi(
    createRoute({
      method: 'patch',
      path: '/{id}',
      tags: ['Admin API Clients'],
      summary: 'Ubah status, scope, nama, URL (client_id & is_first_party immutable)',
      request: {
        params: apiClientIdParamsSchema,
        body: { content: json(updateAdminApiClientBodySchema) },
      },
      responses: {
        200: { description: 'Diperbarui', content: json(apiClientAdminResponseSchema) },
        400: { description: 'Validasi gagal', content: json(errorResponseSchema) },
        404: { description: 'Tidak ditemukan', content: json(errorResponseSchema) },
      },
    }),
    (c) =>
      deps.controller.update(c, c.req.valid('param').id, c.req.valid('json')) as never,
  );

  return routes;
}
