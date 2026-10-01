import type { MiddlewareHandler } from 'hono';
import { createRoute } from '@hono/zod-openapi';
import { z } from 'zod';
import { rateLimit } from '@/shared/middlewares/rate-limit.middleware';
import { createOpenApiApp } from '@/shared/openapi/openapi-app';
import { errorResponseSchema } from '@/shared/openapi/error-response.schema';
import { opaqueId } from '@/shared/validation/id';
import type { AppVariables, AuthUser } from '@/shared/types';
import type { ActivityController } from './activity.controller';
import {
  listActivityQuerySchema,
  listActivityResponseSchema,
  recordCardShareResponseSchema,
} from './validators/activity.validator';

const json = <T extends z.ZodType>(schema: T) => ({
  'application/json': { schema },
});

/** GET /api/v1/activity - feed lintas aktivitas publik (37-api). */
export function createActivityRoutes(deps: {
  controller: ActivityController;
  softAuthenticate: MiddlewareHandler<{ Variables: AppVariables }>;
}) {
  const routes = createOpenApiApp();
  routes.use('*', rateLimit({ points: 100, duration: 60 }));
  // Setelah rateLimit supaya kuota tamu 100/menit/IP tetap terukur untuk semua,
  // termasuk yang tidak mengirim token sama sekali.
  routes.use('/', deps.softAuthenticate);

  const listRoute = createRoute({
    method: 'get',
    path: '/',
    tags: ['Activity'],
    summary: 'Feed lintas aktivitas publik (beranda)',
    description:
      'Gabungan kata baru, komentar, vote, diskusi, kontribusi media, ' +
      'search-miss tayang, dan selamat datang akun terverifikasi. ' +
      'Auth opsional (tidak pernah 401). Cursor opaque (created_at + id); ' +
      'limit 1-50 (default 20). ' +
      '`exclude_self=true` membuang baris milik user yang sedang login; ' +
      'tanpa token sah flag diabaikan dan feed tetap publik penuh.',
    request: { query: listActivityQuerySchema },
    responses: {
      200: {
        description: 'Daftar aktivitas terbaru',
        content: json(listActivityResponseSchema),
      },
      400: { description: 'Query tidak valid', content: json(errorResponseSchema) },
      429: { description: 'Rate limit', content: json(errorResponseSchema) },
    },
  });

  routes.openapi(listRoute, ((c: any) => {
    const q = c.req.valid('query') as z.infer<typeof listActivityQuerySchema>;
    return deps.controller.list(c, q);
  }) as never);

  return routes;
}

/** POST /api/v1/words/:id/card-shares - catat share kartu sukses (sumber feed). */
export function createCardShareRoutes(deps: {
  controller: ActivityController;
  authenticate: MiddlewareHandler<{ Variables: AppVariables }>;
}) {
  const routes = createOpenApiApp();
  // ponytail: tanpa gate scope klien; scope baru butuh token ulang di app lama.
  // Dampak maksimal: baris feed palsu milik user sendiri, dibatasi dedupe 24 jam + rate limit.
  routes.use(
    '/:id/card-shares',
    deps.authenticate,
    rateLimit({
      points: 30,
      duration: 3600,
      keyFn: (c) => {
        const user = (c.get('user') as AuthUser | undefined) ?? null;
        return `card-share:${user?.user_id ?? 'unknown'}`;
      },
    }),
  );

  const recordRoute = createRoute({
    method: 'post',
    path: '/:id/card-shares',
    tags: ['Activity', 'Words'],
    summary: 'Catat share kartu kata yang sukses (login)',
    description:
      'Dipanggil app setelah share sheet tidak dibatalkan. Satu catatan per user+kata ' +
      'per 24 jam; panggilan ulang dalam jendela itu mengembalikan recorded=false (200).',
    request: { params: z.object({ id: opaqueId }) },
    responses: {
      201: { description: 'Tercatat', content: json(recordCardShareResponseSchema) },
      200: { description: 'Sudah tercatat 24 jam terakhir', content: json(recordCardShareResponseSchema) },
      401: { description: 'Token tidak ada/invalid', content: json(errorResponseSchema) },
      404: { description: 'Kata tidak ditemukan', content: json(errorResponseSchema) },
      429: { description: 'Rate limit', content: json(errorResponseSchema) },
    },
  });

  routes.openapi(recordRoute, ((c: any) =>
    deps.controller.recordCardShare(c, c.req.valid('param').id)) as never);

  return routes;
}
