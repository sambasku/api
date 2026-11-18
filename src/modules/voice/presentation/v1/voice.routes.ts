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
      503: {
        description: 'LiveKit belum dikonfigurasi',
        content: json(errorResponseSchema),
      },
    },
  });

  routes.openapi(tokenRoute, (c) => deps.controller.mint(c) as never);

  return routes;
}
