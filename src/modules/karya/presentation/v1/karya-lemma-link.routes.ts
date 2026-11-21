import type { MiddlewareHandler } from 'hono';
import { createRoute } from '@hono/zod-openapi';
import { z } from 'zod';
import { authorizeRole } from '@/shared/middlewares/authorize-role.middleware';
import { rateLimit } from '@/shared/middlewares/rate-limit.middleware';
import { createOpenApiApp } from '@/shared/openapi/openapi-app';
import type { AppVariables } from '@/shared/types';
import type { KaryaLemmaLinkController } from './karya-lemma-link.controller';
import {
  createKaryaLemmaLinkBodySchema,
  excerptIdParamSchema,
  karyaLemmaLinkExcerptParamSchema,
  karyaLemmaLinkIdParamSchema,
  karyaLemmaLinkWireSchema,
  proposeKaryaLemmaCorrectionBodySchema,
  resolveKaryaLemmaCorrectionBodySchema,
} from './validators/karya-lemma-link.validator';

const ok = z.object({ success: z.literal(true), data: z.unknown() });
const json = { 'application/json': { schema: ok } };
const wireJson = { 'application/json': { schema: z.object({ success: z.literal(true), data: karyaLemmaLinkWireSchema }) } };
const listJson = {
  'application/json': {
    schema: z.object({
      success: z.literal(true),
      data: z.array(karyaLemmaLinkWireSchema),
    }),
  },
};

export function createKaryaExcerptLemmaLinkRoutes(deps: {
  controller: KaryaLemmaLinkController;
  authenticate: MiddlewareHandler<{ Variables: AppVariables }>;
  requireApprovedClient?: MiddlewareHandler<{ Variables: AppVariables }>;
  requireLegalConsent?: MiddlewareHandler<{ Variables: AppVariables }>;
}) {
  const routes = createOpenApiApp();
  const writeLimit = rateLimit({ points: 30, duration: 60 });
  routes.use('*', rateLimit({ points: 120, duration: 60 }));

  routes.use('/:excerptId/lemma-links', async (c, next) => {
    if (c.req.method !== 'POST') return next();
    return deps.authenticate(c, next);
  });
  routes.use('/:excerptId/lemma-links', async (c, next) => {
    if (c.req.method !== 'POST') return next();
    if (deps.requireApprovedClient) return deps.requireApprovedClient(c, next);
    return next();
  });
  routes.use('/:excerptId/lemma-links', async (c, next) => {
    if (c.req.method !== 'POST') return next();
    if (deps.requireLegalConsent) return deps.requireLegalConsent(c, next);
    return next();
  });
  routes.use('/:excerptId/lemma-links', async (c, next) => {
    if (c.req.method !== 'POST') return next();
    return writeLimit(c, next);
  });
  routes.use('/:excerptId/lemma-links/*', async (c, next) => {
    if (c.req.method !== 'POST') return next();
    return deps.authenticate(c, next);
  });
  routes.use('/:excerptId/lemma-links/*', async (c, next) => {
    if (c.req.method !== 'POST') return next();
    if (deps.requireApprovedClient) return deps.requireApprovedClient(c, next);
    return next();
  });
  routes.use('/:excerptId/lemma-links/*', async (c, next) => {
    if (c.req.method !== 'POST') return next();
    if (deps.requireLegalConsent) return deps.requireLegalConsent(c, next);
    return next();
  });
  routes.use('/:excerptId/lemma-links/*', async (c, next) => {
    if (c.req.method !== 'POST') return next();
    return writeLimit(c, next);
  });

  routes.use(
    '/:excerptId/lemma-links/:linkId/resolve',
    deps.authenticate,
    authorizeRole('root', 'admin', 'reviewer', 'editor', 'verifier'),
  );

  routes.openapi(
    createRoute({
      method: 'get',
      path: '/{excerptId}/lemma-links',
      tags: ['Karya'],
      request: { params: excerptIdParamSchema },
      responses: { 200: { description: 'Tautan lemma cuplikan', content: listJson } },
    }),
    (c) =>
      deps.controller.listByExcerpt(c, c.req.valid('param').excerptId) as never,
  );

  routes.openapi(
    createRoute({
      method: 'post',
      path: '/{excerptId}/lemma-links',
      tags: ['Karya'],
      request: {
        params: excerptIdParamSchema,
        body: { content: { 'application/json': { schema: createKaryaLemmaLinkBodySchema } }, required: true },
      },
      responses: { 201: { description: 'Created', content: wireJson } },
    }),
    (c) =>
      deps.controller.create(
        c,
        c.req.valid('param').excerptId,
        c.req.valid('json'),
      ) as never,
  );

  routes.openapi(
    createRoute({
      method: 'post',
      path: '/{excerptId}/lemma-links/{linkId}/corrections',
      tags: ['Karya'],
      request: {
        params: karyaLemmaLinkExcerptParamSchema,
        body: {
          content: { 'application/json': { schema: proposeKaryaLemmaCorrectionBodySchema } },
          required: true,
        },
      },
      responses: { 200: { description: 'OK', content: wireJson } },
    }),
    (c) => {
      const p = c.req.valid('param');
      return deps.controller.proposeCorrection(
        c,
        p.excerptId,
        p.linkId,
        c.req.valid('json'),
      ) as never;
    },
  );

  routes.openapi(
    createRoute({
      method: 'post',
      path: '/{excerptId}/lemma-links/{linkId}/resolve',
      tags: ['Karya'],
      request: {
        params: karyaLemmaLinkExcerptParamSchema,
        body: {
          content: { 'application/json': { schema: resolveKaryaLemmaCorrectionBodySchema } },
          required: true,
        },
      },
      responses: { 200: { description: 'OK', content: wireJson } },
    }),
    (c) => {
      const p = c.req.valid('param');
      return deps.controller.resolveCorrection(
        c,
        p.excerptId,
        p.linkId,
        c.req.valid('json'),
      ) as never;
    },
  );

  return routes;
}

export function createKaryaLemmaLinkDeleteRoutes(deps: {
  controller: KaryaLemmaLinkController;
  authenticate: MiddlewareHandler<{ Variables: AppVariables }>;
  requireApprovedClient?: MiddlewareHandler<{ Variables: AppVariables }>;
  requireLegalConsent?: MiddlewareHandler<{ Variables: AppVariables }>;
}) {
  const routes = createOpenApiApp();
  const writeLimit = rateLimit({ points: 30, duration: 60 });
  routes.use('*', rateLimit({ points: 60, duration: 60 }));
  routes.use('/:id', async (c, next) => deps.authenticate(c, next));
  routes.use('/:id', async (c, next) => {
    if (deps.requireApprovedClient) return deps.requireApprovedClient(c, next);
    return next();
  });
  routes.use('/:id', async (c, next) => {
    if (deps.requireLegalConsent) return deps.requireLegalConsent(c, next);
    return next();
  });
  routes.use('/:id', writeLimit);

  routes.openapi(
    createRoute({
      method: 'delete',
      path: '/{id}',
      tags: ['Karya'],
      request: { params: karyaLemmaLinkIdParamSchema },
      responses: { 200: { description: 'Deleted', content: json } },
    }),
    (c) => deps.controller.deleteLink(c, c.req.valid('param').id) as never,
  );

  return routes;
}