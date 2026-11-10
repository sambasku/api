import type { MiddlewareHandler } from 'hono';
import { createRoute } from '@hono/zod-openapi';
import { z } from 'zod';
import { authorizeRole } from '@/shared/middlewares/authorize-role.middleware';
import { rateLimit } from '@/shared/middlewares/rate-limit.middleware';
import { createOpenApiApp } from '@/shared/openapi/openapi-app';
import { errorResponseSchema } from '@/shared/openapi/error-response.schema';
import type { AppVariables, AuthUser } from '@/shared/types';
import type { TranslationController } from './translation.controller';
import {
  createTranslationBodySchema,
  listTranslationsQuerySchema,
  listTranslationsResponseSchema,
  resolveTranslationBodySchema,
  translationIdParamSchema,
  translationResponseSchema,
} from './validators/translation.validator';

const json = <T extends z.ZodType>(schema: T) => ({
  'application/json': { schema },
});

export interface TranslationRoutesDeps {
  controller: TranslationController;
  authenticate: MiddlewareHandler<{ Variables: AppVariables }>;
  requireLegalConsent?: MiddlewareHandler<{ Variables: AppVariables }>;
}

export function createTranslationRoutes(deps: TranslationRoutesDeps) {
  const routes = createOpenApiApp();

  const createLimit = rateLimit({
    points: 30,
    duration: 3600,
    keyFn: (c) => {
      const user = (c.get('user') as AuthUser | undefined) ?? null;
      return `translation-create:${user?.user_id ?? 'unknown'}`;
    },
  });

  // GET publik; POST butuh login (+ consent + rate limit).
  routes.use('/', async (c, next) => {
    if (c.req.method !== 'POST') return next();
    return deps.authenticate(c, next);
  });
  routes.use('/', async (c, next) => {
    if (c.req.method !== 'POST') return next();
    if (deps.requireLegalConsent) return deps.requireLegalConsent(c, next);
    return next();
  });
  routes.use('/', async (c, next) => {
    if (c.req.method !== 'POST') return next();
    return createLimit(c, next);
  });

  const listRoute = createRoute({
    method: 'get',
    path: '/',
    tags: ['Translations'],
    summary: 'Daftar usulan terjemahan (filter reff + reff_id)',
    request: { query: listTranslationsQuerySchema },
    responses: {
      200: {
        description: 'Daftar terjemahan',
        content: json(listTranslationsResponseSchema),
      },
      400: {
        description: 'Query tidak valid',
        content: json(errorResponseSchema),
      },
    },
  });

  const createRouteDef = createRoute({
    method: 'post',
    path: '/',
    tags: ['Translations'],
    summary: 'Usulkan terjemahan (login)',
    request: { body: { content: json(createTranslationBodySchema) } },
    responses: {
      201: {
        description: 'Usulan tersimpan',
        content: json(translationResponseSchema),
      },
      400: {
        description: 'Body tidak valid',
        content: json(errorResponseSchema),
      },
      401: {
        description: 'Unauthorized',
        content: json(errorResponseSchema),
      },
      404: {
        description: 'Sumber tidak ditemukan',
        content: json(errorResponseSchema),
      },
      409: {
        description: 'Masih ada pending',
        content: json(errorResponseSchema),
      },
      429: {
        description: 'Rate limit',
        content: json(errorResponseSchema),
      },
    },
  });

  routes.openapi(listRoute, (c) =>
    deps.controller.list(c, c.req.valid('query')) as never,
  );
  routes.openapi(createRouteDef, (c) =>
    deps.controller.create(c, c.req.valid('json')) as never,
  );

  routes.use(
    '/:id/resolve',
    deps.authenticate,
    authorizeRole('root', 'admin', 'reviewer', 'editor', 'verifier'),
    rateLimit({
      points: 60,
      duration: 60,
      keyFn: (c) => {
        const user = (c.get('user') as AuthUser | undefined) ?? null;
        return `translation-resolve:${user?.user_id ?? 'unknown'}`;
      },
    }),
  );

  const resolveRoute = createRoute({
    method: 'post',
    path: '/:id/resolve',
    tags: ['Translations'],
    summary: 'Setujui atau tolak usulan terjemahan (verifikator)',
    request: {
      params: translationIdParamSchema,
      body: { content: json(resolveTranslationBodySchema) },
    },
    responses: {
      200: {
        description: 'Usulan diproses',
        content: json(translationResponseSchema),
      },
      400: {
        description: 'Body tidak valid',
        content: json(errorResponseSchema),
      },
      401: {
        description: 'Unauthorized',
        content: json(errorResponseSchema),
      },
      403: {
        description: 'Role tidak diizinkan',
        content: json(errorResponseSchema),
      },
      404: {
        description: 'Usulan tidak ditemukan',
        content: json(errorResponseSchema),
      },
      409: {
        description: 'Sudah diproses',
        content: json(errorResponseSchema),
      },
    },
  });

  routes.openapi(resolveRoute, (c) =>
    deps.controller.resolve(
      c,
      c.req.valid('param').id,
      c.req.valid('json'),
    ) as never,
  );

  return routes;
}
