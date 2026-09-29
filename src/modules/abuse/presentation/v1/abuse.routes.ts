import type { MiddlewareHandler } from 'hono';
import { z } from 'zod';
import { createRoute } from '@hono/zod-openapi';
import { authorizeRole } from '@/shared/middlewares/authorize-role.middleware';
import { rateLimit } from '@/shared/middlewares/rate-limit.middleware';
import { createOpenApiApp } from '@/shared/openapi/openapi-app';
import { errorResponseSchema } from '@/shared/openapi/error-response.schema';
import { opaqueId } from '@/shared/validation/id';
import type { AppVariables } from '@/shared/types';
import type { AbuseController } from './abuse.controller';
import {
  anonAbuseEventListResponseSchema,
  anonMuteListResponseSchema,
  liftAnonMuteBodySchema,
  liftAnonMuteResponseSchema,
  liftUserMuteResponseSchema,
  listAnonAbuseEventsQuerySchema,
  listUserAbuseEventsQuerySchema,
  userAbuseEventListResponseSchema,
} from './validators/abuse.validator';

const json = <T extends z.ZodType>(schema: T) => ({
  'application/json': { schema },
});

const authErrors = {
  401: { description: 'Token tidak ada/invalid', content: json(errorResponseSchema) },
  403: { description: 'Role tidak diizinkan (hanya admin/root)', content: json(errorResponseSchema) },
};

// /api/v1/admin/abuse - monitoring ledger abuse UGC, HANYA admin & root
export function createAbuseRoutes(deps: {
  controller: AbuseController;
  authenticate: MiddlewareHandler<{ Variables: AppVariables }>;
}) {
  const routes = createOpenApiApp();

  routes.use(
    '*',
    deps.authenticate,
    authorizeRole('admin', 'root'),
    rateLimit({ points: 500, duration: 60 }), // kategori admin (Section 15)
  );

  const listUserEventsRoute = createRoute({
    method: 'get',
    path: '/user-events',
    tags: ['Admin Abuse'],
    summary: 'Feed sinyal abuse akun login (terbaru dulu)',
    request: { query: listUserAbuseEventsQuerySchema },
    responses: {
      200: { description: 'Daftar event + meta', content: json(userAbuseEventListResponseSchema) },
      ...authErrors,
    },
  });

  const listAnonEventsRoute = createRoute({
    method: 'get',
    path: '/anon-events',
    tags: ['Admin Abuse'],
    summary: 'Feed sinyal abuse tamu per IP/device (terbaru dulu)',
    request: { query: listAnonAbuseEventsQuerySchema },
    responses: {
      200: { description: 'Daftar event + meta', content: json(anonAbuseEventListResponseSchema) },
      ...authErrors,
    },
  });

  const listAnonMutesRoute = createRoute({
    method: 'get',
    path: '/anon-mutes',
    tags: ['Admin Abuse'],
    summary: 'Mute IP/device yang masih aktif (maks 100)',
    responses: {
      200: { description: 'Daftar mute aktif', content: json(anonMuteListResponseSchema) },
      ...authErrors,
    },
  });

  const liftAnonMuteRoute = createRoute({
    method: 'post',
    path: '/anon-mutes/lift',
    tags: ['Admin Abuse'],
    summary: 'Cabut mute IP/device + netralkan skor abuse',
    request: { body: { content: json(liftAnonMuteBodySchema) } },
    responses: {
      200: { description: 'Mute dicabut', content: json(liftAnonMuteResponseSchema) },
      400: { description: 'Body tidak valid', content: json(errorResponseSchema) },
      ...authErrors,
    },
  });

  const liftUserMuteRoute = createRoute({
    method: 'post',
    path: '/users/:id/lift-mute',
    tags: ['Admin Abuse'],
    summary: 'Cabut mute kontribusi akun + netralkan skor abuse',
    request: { params: z.object({ id: opaqueId }) },
    responses: {
      200: { description: 'Mute dicabut', content: json(liftUserMuteResponseSchema) },
      404: { description: 'Pengguna tidak ditemukan (USER_NOT_FOUND)', content: json(errorResponseSchema) },
      ...authErrors,
    },
  });

  routes.openapi(listUserEventsRoute, (c) => deps.controller.listUserEvents(c, c.req.valid('query')) as never);
  routes.openapi(listAnonEventsRoute, (c) => deps.controller.listAnonEvents(c, c.req.valid('query')) as never);
  routes.openapi(listAnonMutesRoute, (c) => deps.controller.listAnonMutes(c) as never);
  routes.openapi(liftAnonMuteRoute, (c) => deps.controller.liftAnonMute(c, c.req.valid('json')) as never);
  routes.openapi(liftUserMuteRoute, (c) =>
    deps.controller.liftUserMute(c, c.req.valid('param').id) as never,
  );
  return routes;
}
