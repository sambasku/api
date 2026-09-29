import type { MiddlewareHandler } from 'hono';
import { createRoute } from '@hono/zod-openapi';
import { authorizeRole } from '@/shared/middlewares/authorize-role.middleware';
import { rateLimit } from '@/shared/middlewares/rate-limit.middleware';
import { createOpenApiApp } from '@/shared/openapi/openapi-app';
import { errorResponseSchema } from '@/shared/openapi/error-response.schema';
import type { AppVariables } from '@/shared/types';
import type { SystemDatabaseController } from './system-database.controller';
import {
  listBackupLogsQuerySchema,
  listBackupLogsResponseSchema,
  triggerBackupBodySchema,
  triggerBackupResponseSchema,
} from './validators/system-database.validator';

const json = <T extends import('zod').ZodType>(schema: T) => ({
  'application/json': { schema },
});

export interface SystemDatabaseRoutesDeps {
  controller: SystemDatabaseController;
  authenticate: MiddlewareHandler<{ Variables: AppVariables }>;
}

/** Admin System > Database - mount di /api/v1/admin/system/database */
export function createSystemDatabaseRoutes(deps: SystemDatabaseRoutesDeps) {
  const routes = createOpenApiApp();

  routes.use(
    '*',
    deps.authenticate,
    authorizeRole('admin', 'root'),
  );

  routes.use('/backup', rateLimit({ points: 5, duration: 60 }));
  routes.use('/backups', rateLimit({ points: 60, duration: 60 }));

  routes.openapi(
    createRoute({
      method: 'post',
      path: '/backup',
      tags: ['Admin System Database'],
      summary: 'Trigger backup encrypted ke repo sambasku/sqlite',
      request: { body: { content: json(triggerBackupBodySchema) } },
      responses: {
        202: { description: 'Workflow di-dispatch', content: json(triggerBackupResponseSchema) },
        401: { description: 'Tidak terautentikasi', content: json(errorResponseSchema) },
        403: { description: 'Bukan admin/root', content: json(errorResponseSchema) },
        502: { description: 'GitHub upstream gagal', content: json(errorResponseSchema) },
        503: { description: 'Token/URL belum dikonfigurasi', content: json(errorResponseSchema) },
      },
    }),
    (c) => deps.controller.triggerBackup(c, c.req.valid('json')) as never,
  );

  routes.openapi(
    createRoute({
      method: 'get',
      path: '/backups',
      tags: ['Admin System Database'],
      summary: 'Daftar log backup (ditulis CI sqlite ke Turso)',
      request: { query: listBackupLogsQuerySchema },
      responses: {
        200: { description: 'Daftar log', content: json(listBackupLogsResponseSchema) },
        401: { description: 'Tidak terautentikasi', content: json(errorResponseSchema) },
        403: { description: 'Bukan admin/root', content: json(errorResponseSchema) },
      },
    }),
    (c) => deps.controller.listBackups(c, c.req.valid('query')) as never,
  );

  return routes;
}
