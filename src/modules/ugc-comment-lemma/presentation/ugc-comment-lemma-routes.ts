import type { MiddlewareHandler } from 'hono';
import { createRoute } from '@hono/zod-openapi';
import { z } from 'zod';
import { createOpenApiApp } from '@/shared/openapi/openapi-app';
import { errorResponseSchema, okNullResponseSchema } from '@/shared/openapi/error-response.schema';
import type { AppVariables } from '@/shared/types';
import type { UgcCommentAnchorKind } from '@/shared/database/drizzle/schema/ugc-comment-lemma-links.schema';
import type { UgcCommentLemmaController } from './ugc-comment-lemma.controller';
import {
  createUgcCommentLemmaLinkBodySchema,
  ugcCommentLemmaLinkWireSchema,
} from './validators/ugc-comment-lemma.validator';

const json = <T extends z.ZodType>(schema: T) => ({
  'application/json': { schema },
});

const opaqueId = z.string().min(1).max(64);

export interface UgcCommentLemmaRoutesConfig {
  anchorKind: UgcCommentAnchorKind;
  /** Path relatif host + comment, mis. `/:hostId/comments/:commentId/lemma-links`. */
  path: string;
  hostParam: string;
  commentParam: string;
}

export interface UgcCommentLemmaRoutesDeps {
  controller: UgcCommentLemmaController;
  authenticate: MiddlewareHandler<{ Variables: AppVariables }>;
  requireApprovedClient?: MiddlewareHandler<{ Variables: AppVariables }>;
  requireLegalConsent?: MiddlewareHandler<{ Variables: AppVariables }>;
}

export function createUgcCommentLemmaRoutes(
  config: UgcCommentLemmaRoutesConfig,
  deps: UgcCommentLemmaRoutesDeps,
) {
  const routes = createOpenApiApp();
  const base = config.path;

  routes.use(base, deps.authenticate);
  if (deps.requireApprovedClient) routes.use(base, deps.requireApprovedClient);
  if (deps.requireLegalConsent) routes.use(base, deps.requireLegalConsent);
  routes.use(`${base}/:linkId`, deps.authenticate);

  const createRouteDef = createRoute({
    method: 'post',
    path: base,
    tags: ['UgcCommentLemma'],
    summary: 'Tautkan span lemma di komentar',
    request: {
      params: z.object({
        [config.hostParam]: opaqueId,
        [config.commentParam]: opaqueId,
      }),
      body: { content: json(createUgcCommentLemmaLinkBodySchema) },
    },
    responses: {
      201: {
        description: 'Tautan dibuat',
        content: json(
          z.object({
            success: z.literal(true),
            data: ugcCommentLemmaLinkWireSchema,
          }),
        ),
      },
      400: { description: 'Span tidak valid', content: json(errorResponseSchema) },
      401: { description: 'Unauthorized', content: json(errorResponseSchema) },
      404: { description: 'Komentar tidak ditemukan', content: json(errorResponseSchema) },
    },
  });

  const deleteRouteDef = createRoute({
    method: 'delete',
    path: `${base}/:linkId`,
    tags: ['UgcCommentLemma'],
    summary: 'Hapus tautan lemma di komentar',
    request: {
      params: z.object({
        [config.hostParam]: opaqueId,
        [config.commentParam]: opaqueId,
        linkId: opaqueId,
      }),
    },
    responses: {
      200: { description: 'Dihapus', content: json(okNullResponseSchema) },
      401: { description: 'Unauthorized', content: json(errorResponseSchema) },
      403: { description: 'Forbidden', content: json(errorResponseSchema) },
      404: { description: 'Tidak ditemukan', content: json(errorResponseSchema) },
    },
  });

  routes.openapi(createRouteDef, (c) => {
    const params = c.req.valid('param' as never) as Record<string, string>;
    return deps.controller.create(c, {
      anchorKind: config.anchorKind,
      hostId: params[config.hostParam],
      commentId: params[config.commentParam],
      body: c.req.valid('json' as never) as never,
    }) as never;
  });

  routes.openapi(deleteRouteDef, (c) => {
    const params = c.req.valid('param' as never) as Record<string, string>;
    return deps.controller.remove(c, {
      anchorKind: config.anchorKind,
      hostId: params[config.hostParam],
      commentId: params[config.commentParam],
      linkId: params.linkId,
    }) as never;
  });

  return routes;
}