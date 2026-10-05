import type { MiddlewareHandler } from 'hono';
import { createRoute } from '@hono/zod-openapi';
import { authorizeRole } from '@/shared/middlewares/authorize-role.middleware';
import { rateLimit } from '@/shared/middlewares/rate-limit.middleware';
import { createOpenApiApp } from '@/shared/openapi/openapi-app';
import { errorResponseSchema } from '@/shared/openapi/error-response.schema';
import type { AppVariables } from '@/shared/types';
import type { SystemSupabaseController } from './system-supabase.controller';
import {
  listSupabaseHealthChecksQuerySchema,
  listSupabaseHealthChecksResponseSchema,
  triggerSupabasePingResponseSchema,
} from './validators/system-supabase.validator';

const json = <T extends import('zod').ZodType>(schema: T) => ({
  'application/json': { schema },
});

export interface SystemSupabaseRoutesDeps {
  controller: SystemSupabaseController;
  authenticate: MiddlewareHandler<{ Variables: AppVariables }>;
}

/** Admin System > Supabase - mount di /api/v1/admin/system/supabase */
export function createSystemSupabaseRoutes(deps: SystemSupabaseRoutesDeps) {
  const routes = createOpenApiApp();

  routes.use('*', deps.authenticate, authorizeRole('admin', 'root'));
  routes.use('/health-checks', rateLimit({ points: 60, duration: 60 }));
  routes.use('/ping', rateLimit({ points: 5, duration: 60 }));

  routes.openapi(
    createRoute({
      method: 'get',
      path: '/health-checks',
      tags: ['Admin System Supabase'],
      summary: 'Riwayat ping keep-alive Supabase (ditulis CI, API hanya baca)',
      request: { query: listSupabaseHealthChecksQuerySchema },
      responses: {
        200: { description: 'Daftar log health check', content: json(listSupabaseHealthChecksResponseSchema) },
        401: { description: 'Tidak terautentikasi', content: json(errorResponseSchema) },
        403: { description: 'Bukan admin/root', content: json(errorResponseSchema) },
      },
    }),
    (c) => deps.controller.listHealthChecks(c, c.req.valid('query')) as never,
  );

  routes.openapi(
    createRoute({
      method: 'post',
      path: '/ping',
      tags: ['Admin System Supabase'],
      summary: 'Ping manual /auth/v1/health dari console (hasil langsung + masuk log)',
      request: {},
      responses: {
        200: { description: 'Hasil ping', content: json(triggerSupabasePingResponseSchema) },
        401: { description: 'Tidak terautentikasi', content: json(errorResponseSchema) },
        403: { description: 'Bukan admin/root', content: json(errorResponseSchema) },
        503: { description: 'Env Supabase belum dikonfigurasi', content: json(errorResponseSchema) },
      },
    }),
    (c) => deps.controller.triggerPing(c) as never,
  );

  return routes;
}
