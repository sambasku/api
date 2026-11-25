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
import type { WordOfDayAdminController } from './word-of-day-admin.controller';

const json = <T extends z.ZodType>(schema: T) => ({
  'application/json': { schema },
});

const dateQuery = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

const dateRequiredQuery = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

const historyQuery = z.object({
  limit: z.coerce.number().int().min(1).max(100).optional(),
});

const setBody = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  word_id: z.string().min(1).max(64),
});

const rowSchema = z.object({
  date: z.string(),
  word_id: z.string().nullable(),
  lemma: z.string().nullable(),
  source: z.enum(['manual', 'algorithm', 'empty']),
  updated_at: z.string().nullable(),
  updated_by: z.string().nullable(),
});

export interface WordOfDayAdminRoutesDeps {
  controller: WordOfDayAdminController;
  authenticate: MiddlewareHandler<{ Variables: AppVariables }>;
}

export function createAdminWordOfDayRoutes(deps: WordOfDayAdminRoutesDeps) {
  const routes = createOpenApiApp();
  routes.use('*', rateLimit({ points: 60, duration: 60 }));
  routes.use('*', deps.authenticate, authorizeRole('root', 'admin'));

  const getRoute = createRoute({
    method: 'get',
    path: '/',
    tags: ['Word of Day Admin'],
    summary: 'Status kata hari ini untuk tanggal WIB',
    request: { query: dateQuery },
    responses: {
      200: {
        description: 'Pilihan aktif / pratinjau algoritma',
        content: json(z.object({ success: z.literal(true), data: rowSchema })),
      },
    },
  });

  const historyRoute = createRoute({
    method: 'get',
    path: '/history',
    tags: ['Word of Day Admin'],
    summary: 'Riwayat pilihan tersimpan (app_settings)',
    request: { query: historyQuery },
    responses: {
      200: {
        description: 'Riwayat',
        content: json(
          z.object({
            success: z.literal(true),
            data: z.array(
              rowSchema.extend({ word_id: z.string() }),
            ),
          }),
        ),
      },
    },
  });

  const setRoute = createRoute({
    method: 'put',
    path: '/',
    tags: ['Word of Day Admin'],
    summary: 'Ganti kata hari ini (override manual)',
    request: {
      body: { content: { 'application/json': { schema: setBody } } },
    },
    responses: {
      200: {
        description: 'Tersimpan',
        content: json(z.object({ success: z.literal(true), data: rowSchema })),
      },
      400: { description: 'Validasi', content: json(errorResponseSchema) },
    },
  });

  const clearRoute = createRoute({
    method: 'delete',
    path: '/',
    tags: ['Word of Day Admin'],
    summary: 'Hapus simpanan (besok jalan algoritma lagi)',
    request: { query: dateRequiredQuery },
    responses: {
      200: { description: 'Dihapus', content: json(okNullResponseSchema) },
      404: { description: 'Tidak ada', content: json(errorResponseSchema) },
    },
  });

  routes.openapi(getRoute, (c) =>
    deps.controller.get(c, c.req.valid('query')) as never,
  );
  routes.openapi(historyRoute, (c) =>
    deps.controller.history(c, c.req.valid('query')) as never,
  );
  routes.openapi(setRoute, (c) =>
    deps.controller.set(c, c.req.valid('json')) as never,
  );
  routes.openapi(clearRoute, (c) =>
    deps.controller.clear(c, c.req.valid('query')) as never,
  );

  return routes;
}