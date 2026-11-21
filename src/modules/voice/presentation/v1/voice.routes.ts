import type { MiddlewareHandler } from 'hono';
import { createRoute } from '@hono/zod-openapi';
import { z } from 'zod';
import { createOpenApiApp } from '@/shared/openapi/openapi-app';
import { errorResponseSchema } from '@/shared/openapi/error-response.schema';
import type { AppVariables } from '@/shared/types';
import { rateLimit } from '@/shared/middlewares/rate-limit.middleware';
import type { VoiceController } from './voice.controller';

const json = <T extends z.ZodType>(schema: T) => ({
  'application/json': { schema },
});

const voiceTokenResponseSchema = z.object({
  success: z.literal(true),
  data: z.object({
    token: z.string(),
    url: z.string(),
    room: z.string(),
    maxParticipants: z.number().int().positive(),
  }),
});

const turnCredsResponseSchema = z.object({
  success: z.literal(true),
  data: z.object({
    urls: z.array(z.string()).min(1),
    username: z.string(),
    credential: z.string(),
    ttl: z.number().int().positive(),
  }),
});

const voiceEventBodySchema = z.object({
  kind: z.enum(['joined', 'left', 'disconnect', 'join_failed']),
  room: z.string().max(80).optional(),
  errorCode: z.string().max(64).optional(),
  detail: z.string().max(240).optional(),
  platform: z.string().max(32).optional(),
});

const voiceEventResponseSchema = z.object({
  success: z.literal(true),
  data: z.object({
    kind: z.enum(['joined', 'left', 'disconnect', 'join_failed']),
  }),
});

const voiceRoomSummaryResponseSchema = z.object({
  success: z.literal(true),
  data: z.object({
    room: z.string(),
    participant_count: z.number().int().min(0),
    voice_room_enabled: z.boolean(),
  }),
});

export interface VoiceRoutesDeps {
  controller: VoiceController;
  authenticate: MiddlewareHandler<{ Variables: AppVariables }>;
  requireApprovedClient?: MiddlewareHandler<{ Variables: AppVariables }>;
  requireLegalConsent?: MiddlewareHandler<{ Variables: AppVariables }>;
}

export function createVoiceRoutes(deps: VoiceRoutesDeps) {
  const routes = createOpenApiApp();

  const summaryRoute = createRoute({
    method: 'get',
    path: '/room/summary',
    tags: ['Voice'],
    summary: 'Ringkasan voice room (jumlah peserta, tanpa auth)',
    responses: {
      200: {
        description: 'Ringkasan room',
        content: json(voiceRoomSummaryResponseSchema),
      },
    },
  });

  routes.use('/room/summary', rateLimit({ points: 30, duration: 60 }));
  routes.openapi(summaryRoute, (c) => deps.controller.summary(c) as never);

  routes.use('*', rateLimit({ points: 30, duration: 60 }));
  routes.use('*', deps.authenticate);
  if (deps.requireApprovedClient) {
    routes.use('*', deps.requireApprovedClient);
  }
  if (deps.requireLegalConsent) {
    routes.use('*', deps.requireLegalConsent);
  }

  const tokenRoute = createRoute({
    method: 'post',
    path: '/token',
    tags: ['Voice'],
    summary: 'Mint JWT LiveKit untuk voice room global',
    responses: {
      200: {
        description: 'Token + URL + room',
        content: json(voiceTokenResponseSchema),
      },
      401: {
        description: 'Token tidak ada/invalid',
        content: json(errorResponseSchema),
      },
      403: {
        description: 'Voice room dimatikan / consent',
        content: json(errorResponseSchema),
      },
      409: {
        description:
          'VOICE_ROOM_FULL atau VOICE_ALREADY_JOINED (akun sudah di device lain)',
        content: json(errorResponseSchema),
      },
      400: {
        description: 'DEVICE_ID_REQUIRED (header X-Device-Id hilang/invalid)',
        content: json(errorResponseSchema),
      },
      503: {
        description: 'LiveKit belum dikonfigurasi / homelab tidak terjangkau',
        content: json(errorResponseSchema),
      },
    },
  });

  const turnCredsRoute = createRoute({
    method: 'get',
    path: '/turn-creds',
    tags: ['Voice'],
    summary: 'Mint kredensial coturn time-limited untuk ICE relay',
    responses: {
      200: {
        description: 'urls + username + credential + ttl',
        content: json(turnCredsResponseSchema),
      },
      401: {
        description: 'Token tidak ada/invalid',
        content: json(errorResponseSchema),
      },
      503: {
        description: 'TURN_SECRET belum dikonfigurasi',
        content: json(errorResponseSchema),
      },
    },
  });

  const eventRoute = createRoute({
    method: 'post',
    path: '/events',
    tags: ['Voice'],
    summary: 'Catat event voice room (analitik internal, bukan feed)',
    request: {
      body: {
        required: true,
        content: json(voiceEventBodySchema),
      },
    },
    responses: {
      200: {
        description: 'Event tersimpan',
        content: json(voiceEventResponseSchema),
      },
      400: {
        description: 'Body tidak valid',
        content: json(errorResponseSchema),
      },
      401: {
        description: 'Token tidak ada/invalid',
        content: json(errorResponseSchema),
      },
    },
  });

  routes.openapi(tokenRoute, (c) => deps.controller.mint(c) as never);
  routes.openapi(turnCredsRoute, (c) => deps.controller.turnCreds(c) as never);
  routes.openapi(eventRoute, (c) => deps.controller.event(c) as never);

  return routes;
}
