import type { MiddlewareHandler } from 'hono';
import { createRoute } from '@hono/zod-openapi';
import { z } from 'zod';
import { rateLimit } from '@/shared/middlewares/rate-limit.middleware';
import { createOpenApiApp } from '@/shared/openapi/openapi-app';
import { errorResponseSchema } from '@/shared/openapi/error-response.schema';
import { opaqueId } from '@/shared/validation/id';
import type { AppVariables, AuthUser } from '@/shared/types';
import type { ConfirmDuplicateMeaningUseCase } from '../../application/use-cases/confirm-duplicate-meaning.use-case';
import { UnauthorizedError } from '@/shared/errors/app-error';

const json = <T extends z.ZodType>(schema: T) => ({
  'application/json': { schema },
});

export const duplicateConfirmBodySchema = z.object({
  word_id: opaqueId,
  meaning_id: opaqueId,
  value: z.union([z.literal(1), z.literal(-1)]),
});

export type DuplicateConfirmBody = z.infer<typeof duplicateConfirmBodySchema>;

export const duplicateConfirmResponseSchema = z.object({
  success: z.literal(true),
  data: z.object({
    word_id: z.string(),
    meaning_id: z.string(),
    lemma: z.string(),
    my_vote: z.union([z.literal(1), z.literal(-1), z.null()]),
    upvotes: z.number().int(),
    downvotes: z.number().int(),
    message: z.string(),
  }),
});

export interface DuplicateConfirmRoutesDeps {
  confirmDuplicate: ConfirmDuplicateMeaningUseCase;
  authenticate: MiddlewareHandler<{ Variables: AppVariables }>;
  requireApprovedClient?: MiddlewareHandler<{ Variables: AppVariables }>;
}

/** POST /api/v1/contributions/duplicate-confirm - vote + audit riwayat. */
export function createDuplicateConfirmRoutes(deps: DuplicateConfirmRoutesDeps) {
  const routes = createOpenApiApp();

  const guards = [
    deps.authenticate,
    ...(deps.requireApprovedClient ? [deps.requireApprovedClient] : []),
    rateLimit({
      points: 60,
      duration: 60,
      keyFn: (c) => {
        const user = (c.get('user') as AuthUser | undefined) ?? null;
        return `duplicate-confirm:${user?.user_id ?? 'unknown'}`;
      },
    }),
  ];
  routes.use('/duplicate-confirm', ...guards);

  const confirmRoute = createRoute({
    method: 'post',
    path: '/duplicate-confirm',
    tags: ['Contributions'],
    summary:
      'Konfirmasi makna duplikat: upvote/downvote makna yang sudah ada + catat di riwayat perubahan',
    request: { body: { content: json(duplicateConfirmBodySchema) } },
    responses: {
      200: { description: 'Vote tercatat + jejak riwayat', content: json(duplicateConfirmResponseSchema) },
      400: { description: 'Body tidak valid', content: json(errorResponseSchema) },
      401: { description: 'Token tidak ada/invalid', content: json(errorResponseSchema) },
      404: { description: 'Makna/kata tidak ditemukan atau belum tayang', content: json(errorResponseSchema) },
    },
  });

  routes.openapi(confirmRoute, async (c) => {
    const user = c.get('user') as AuthUser | undefined;
    if (!user) throw new UnauthorizedError('UNAUTHORIZED', 'Token tidak disertakan');
    const body = c.req.valid('json');
    const result = await deps.confirmDuplicate.execute({
      wordId: body.word_id,
      meaningId: body.meaning_id,
      value: body.value,
      userId: user.user_id,
      requestId: c.get('requestId') ?? null,
      clientId: user.azp ?? null,
    });
    return c.json({
      success: true as const,
      data: {
        word_id: result.wordId,
        meaning_id: result.meaningId,
        lemma: result.lemma,
        my_vote: result.myVote,
        upvotes: result.upvotes,
        downvotes: result.downvotes,
        message: result.message,
      },
    });
  });

  return routes;
}
