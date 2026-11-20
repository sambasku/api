import type { MiddlewareHandler } from 'hono';
import { createRoute } from '@hono/zod-openapi';
import { z } from 'zod';
import { createOpenApiApp } from '@/shared/openapi/openapi-app';
import { errorResponseSchema } from '@/shared/openapi/error-response.schema';
import type { AppVariables } from '@/shared/types';
import { clientIpKey, rateLimit } from '@/shared/middlewares/rate-limit.middleware';
import type { ChatController } from './chat.controller';
import {
  chatCapabilitiesResponseSchema,
  chatMessageIdParamSchema,
  chatMessageListResponseSchema,
  chatMessageResponseSchema,
  chatPingResponseSchema,
  chatPingStatusResponseSchema,
  chatRevisionsResponseSchema,
  createChatMessageBodySchema,
  editChatMessageBodySchema,
  listChatMessagesQuerySchema,
} from './validators/chat.validator';

const json = <T extends z.ZodType>(schema: T) => ({
  'application/json': { schema },
});

export interface ChatRoutesDeps {
  controller: ChatController;
  authenticate: MiddlewareHandler<{ Variables: AppVariables }>;
  optionalAuthenticate: MiddlewareHandler<{ Variables: AppVariables }>;
  requireApprovedClient?: MiddlewareHandler<{ Variables: AppVariables }>;
  requireLegalConsent?: MiddlewareHandler<{ Variables: AppVariables }>;
  onUgcRateLimited?: (userId: string) => void | Promise<void>;
}

function ugcRateLimitedHook(
  onUgcRateLimited?: (userId: string) => void | Promise<void>,
) {
  return async (c: {
    get: (k: 'user') => { user_id: string } | undefined;
  }) => {
    const uid = c.get('user')?.user_id;
    if (uid && onUgcRateLimited) await onUgcRateLimited(uid);
  };
}

function chatWriteUserLimit(
  onUgcRateLimited?: (userId: string) => void | Promise<void>,
) {
  return rateLimit({
    points: 30,
    duration: 3600,
    keyFn: (c) => {
      const uid = (
        c as { get: (k: 'user') => { user_id: string } | undefined }
      ).get('user')?.user_id;
      return uid ? `chat-write:user:${uid}` : '';
    },
    onLimited: ugcRateLimitedHook(onUgcRateLimited),
  });
}

function chatWriteIpLimit() {
  return rateLimit({
    points: 60,
    duration: 3600,
    keyFn: (c) => `chat-write:ip:${clientIpKey(c)}`,
  });
}

/** Burst anti-spam: max 10 tulis / 60 detik per user. */
function chatWriteBurstUserLimit(
  onUgcRateLimited?: (userId: string) => void | Promise<void>,
) {
  return rateLimit({
    points: 10,
    duration: 60,
    keyFn: (c) => {
      const uid = (
        c as { get: (k: 'user') => { user_id: string } | undefined }
      ).get('user')?.user_id;
      return uid ? `chat-write-burst:user:${uid}` : '';
    },
    onLimited: ugcRateLimitedHook(onUgcRateLimited),
  });
}

function chatPingGlobalLimit() {
  return rateLimit({
    points: 1,
    duration: 300,
    keyFn: () => 'chat-ping:global',
  });
}

export function createChatRoutes(deps: ChatRoutesDeps) {
  const routes = createOpenApiApp();
  const writeUserLimit = chatWriteUserLimit(deps.onUgcRateLimited);
  const writeIpLimit = chatWriteIpLimit();
  const writeBurstLimit = chatWriteBurstUserLimit(deps.onUgcRateLimited);
  const pingGlobalLimit = chatPingGlobalLimit();

  routes.use('*', rateLimit({ points: 120, duration: 60 }));

  const capabilitiesRoute = createRoute({
    method: 'get',
    path: '/capabilities',
    tags: ['Chat'],
    summary: 'Flag voice room (app_settings voice.room_enabled)',
    responses: {
      200: {
        description: 'Kemampuan chat',
        content: json(chatCapabilitiesResponseSchema),
      },
    },
  });

  const listRoute = createRoute({
    method: 'get',
    path: '/messages',
    tags: ['Chat'],
    summary: 'Histori chat channel public (keyset Turso)',
    request: { query: listChatMessagesQuerySchema },
    responses: {
      200: {
        description: 'Daftar pesan (ASC)',
        content: json(chatMessageListResponseSchema),
      },
      400: {
        description: 'Query tidak valid',
        content: json(errorResponseSchema),
      },
    },
  });

  const createRouteDef = createRoute({
    method: 'post',
    path: '/messages',
    tags: ['Chat'],
    summary: 'Kirim pesan teks / stiker / reply',
    request: {
      body: { content: json(createChatMessageBodySchema), required: true },
    },
    responses: {
      201: {
        description: 'Pesan dibuat (wire untuk optimistic append)',
        content: json(chatMessageResponseSchema),
      },
      400: {
        description: 'Body tidak valid',
        content: json(errorResponseSchema),
      },
      401: {
        description: 'Token tidak ada/invalid',
        content: json(errorResponseSchema),
      },
      403: {
        description: 'Tidak diizinkan / consent',
        content: json(errorResponseSchema),
      },
    },
  });

  const createVoiceRoute = createRoute({
    method: 'post',
    path: '/messages/voice',
    tags: ['Chat'],
    summary: 'Kirim voice note (multipart; 1-60 detik)',
    request: {
      body: {
        content: {
          'multipart/form-data': {
            schema: z.object({
              audio: z.any().openapi({ type: 'string', format: 'binary' }),
              duration_ms: z.coerce.number().int(),
              reply_to_id: z.string().optional(),
            }),
          },
        },
      },
    },
    responses: {
      201: {
        description: 'Voice note dibuat',
        content: json(chatMessageResponseSchema),
      },
      400: {
        description: 'File/MIME/durasi tidak valid',
        content: json(errorResponseSchema),
      },
      401: {
        description: 'Token tidak ada/invalid',
        content: json(errorResponseSchema),
      },
      403: {
        description: 'Tidak diizinkan / consent',
        content: json(errorResponseSchema),
      },
      429: {
        description: 'Rate limit',
        content: json(errorResponseSchema),
      },
      503: {
        description: 'Storage audio belum dikonfigurasi',
        content: json(errorResponseSchema),
      },
    },
  });

  const editRoute = createRoute({
    method: 'patch',
    path: '/messages/{id}',
    tags: ['Chat'],
    summary: 'Sunting pesan teks (author) + simpan revisi',
    request: {
      params: chatMessageIdParamSchema,
      body: { content: json(editChatMessageBodySchema), required: true },
    },
    responses: {
      200: {
        description: 'Pesan disunting',
        content: json(chatMessageResponseSchema),
      },
      400: {
        description: 'Body / kind tidak valid',
        content: json(errorResponseSchema),
      },
      401: {
        description: 'Token tidak ada/invalid',
        content: json(errorResponseSchema),
      },
      403: {
        description: 'Bukan penulis',
        content: json(errorResponseSchema),
      },
      404: {
        description: 'Tidak ditemukan',
        content: json(errorResponseSchema),
      },
    },
  });

  const deleteRoute = createRoute({
    method: 'delete',
    path: '/messages/{id}',
    tags: ['Chat'],
    summary: 'Tombstone pesan (author)',
    request: { params: chatMessageIdParamSchema },
    responses: {
      200: {
        description: 'Pesan di-tombstone',
        content: json(chatMessageResponseSchema),
      },
      401: {
        description: 'Token tidak ada/invalid',
        content: json(errorResponseSchema),
      },
      403: {
        description: 'Bukan penulis',
        content: json(errorResponseSchema),
      },
      404: {
        description: 'Tidak ditemukan',
        content: json(errorResponseSchema),
      },
    },
  });

  const revisionsRoute = createRoute({
    method: 'get',
    path: '/messages/{id}/revisions',
    tags: ['Chat'],
    summary: 'Riwayat suntingan pesan (Turso)',
    request: { params: chatMessageIdParamSchema },
    responses: {
      200: {
        description: 'Daftar revisi',
        content: json(chatRevisionsResponseSchema),
      },
      401: {
        description: 'Token tidak ada/invalid',
        content: json(errorResponseSchema),
      },
      404: {
        description: 'Tidak ditemukan',
        content: json(errorResponseSchema),
      },
    },
  });


  const pingStatusRoute = createRoute({
    method: 'get',
    path: '/ping',
    tags: ['Chat'],
    summary: 'Status cooldown ping global (5 menit)',
    responses: {
      200: {
        description: 'Status ping',
        content: json(chatPingStatusResponseSchema),
      },
    },
  });
  const pingRoute = createRoute({
    method: 'post',
    path: '/ping',
    tags: ['Chat'],
    summary: 'Kirim ping (jejak PING!!! + bel; cooldown global 5 menit)',
    responses: {
      201: {
        description: 'Ping tersimpan',
        content: json(chatPingResponseSchema),
      },
      401: {
        description: 'Token tidak ada/invalid',
        content: json(errorResponseSchema),
      },
      429: {
        description: 'Cooldown ping global',
        content: json(errorResponseSchema),
      },
    },
  });

  // GET list: optional auth. POST create (+ voice): auth + client + consent + rate limit.
  routes.use('/messages', async (c, next) => {
    if (c.req.method === 'GET') return deps.optionalAuthenticate(c, next);
    if (c.req.method === 'POST') return deps.authenticate(c, next);
    return next();
  });
  routes.use('/messages', async (c, next) => {
    if (c.req.method !== 'POST') return next();
    if (deps.requireApprovedClient) return deps.requireApprovedClient(c, next);
    return next();
  });
  routes.use('/messages', async (c, next) => {
    if (c.req.method !== 'POST') return next();
    if (deps.requireLegalConsent) return deps.requireLegalConsent(c, next);
    return next();
  });
  routes.use('/messages', async (c, next) => {
    if (c.req.method !== 'POST') return next();
    return writeUserLimit(c, next);
  });
  routes.use('/messages', async (c, next) => {
    if (c.req.method !== 'POST') return next();
    return writeIpLimit(c, next);
  });
  routes.use('/messages', async (c, next) => {
    if (c.req.method !== 'POST') return next();
    return writeBurstLimit(c, next);
  });

  // Voice note: path /messages/voice - pastikan gate sama (Hono path exact).
  routes.use('/messages/voice', async (c, next) => {
    if (c.req.method !== 'POST') return next();
    return deps.authenticate(c, next);
  });
  routes.use('/messages/voice', async (c, next) => {
    if (c.req.method !== 'POST') return next();
    if (deps.requireApprovedClient) return deps.requireApprovedClient(c, next);
    return next();
  });
  routes.use('/messages/voice', async (c, next) => {
    if (c.req.method !== 'POST') return next();
    if (deps.requireLegalConsent) return deps.requireLegalConsent(c, next);
    return next();
  });
  routes.use('/messages/voice', async (c, next) => {
    if (c.req.method !== 'POST') return next();
    return writeUserLimit(c, next);
  });
  routes.use('/messages/voice', async (c, next) => {
    if (c.req.method !== 'POST') return next();
    return writeIpLimit(c, next);
  });
  routes.use('/messages/voice', async (c, next) => {
    if (c.req.method !== 'POST') return next();
    return writeBurstLimit(c, next);
  });

  // PATCH/DELETE: author write gates.
  routes.use('/messages/:id', async (c, next) => {
    if (c.req.method !== 'PATCH' && c.req.method !== 'DELETE') return next();
    return deps.authenticate(c, next);
  });
  routes.use('/messages/:id', async (c, next) => {
    if (c.req.method !== 'PATCH' && c.req.method !== 'DELETE') return next();
    if (deps.requireApprovedClient) return deps.requireApprovedClient(c, next);
    return next();
  });
  routes.use('/messages/:id', async (c, next) => {
    if (c.req.method !== 'PATCH' && c.req.method !== 'DELETE') return next();
    if (deps.requireLegalConsent) return deps.requireLegalConsent(c, next);
    return next();
  });
  routes.use('/messages/:id', async (c, next) => {
    if (c.req.method !== 'PATCH' && c.req.method !== 'DELETE') return next();
    return writeUserLimit(c, next);
  });

  routes.use('/messages/:id/revisions', deps.authenticate);

  routes.use('/ping', async (c, next) => {
    if (c.req.method !== 'POST') return next();
    return deps.authenticate(c, next);
  });
  routes.use('/ping', async (c, next) => {
    if (c.req.method !== 'POST') return next();
    if (deps.requireApprovedClient) return deps.requireApprovedClient(c, next);
    return next();
  });
  routes.use('/ping', async (c, next) => {
    if (c.req.method !== 'POST') return next();
    if (deps.requireLegalConsent) return deps.requireLegalConsent(c, next);
    return next();
  });
  routes.use('/ping', async (c, next) => {
    if (c.req.method !== 'POST') return next();
    return pingGlobalLimit(c, next);
  });

  routes.openapi(capabilitiesRoute, (c) =>
    deps.controller.getCapabilities(c) as never,
  );
  routes.openapi(listRoute, (c) =>
    deps.controller.list(c, c.req.valid('query')) as never,
  );
  routes.openapi(createRouteDef, (c) =>
    deps.controller.create(c, c.req.valid('json')) as never,
  );
  routes.openapi(createVoiceRoute, (c) =>
    deps.controller.createVoice(c) as never,
  );
  routes.openapi(editRoute, (c) =>
    deps.controller.edit(
      c,
      c.req.valid('param').id,
      c.req.valid('json'),
    ) as never,
  );
  routes.openapi(deleteRoute, (c) =>
    deps.controller.remove(c, c.req.valid('param').id) as never,
  );
  routes.openapi(revisionsRoute, (c) =>
    deps.controller.revisions(c, c.req.valid('param').id) as never,
  );
  routes.openapi(pingStatusRoute, (c) =>
    deps.controller.pingStatus(c) as never,
  );
  routes.openapi(pingRoute, (c) => deps.controller.ping(c) as never);

  return routes;
}
