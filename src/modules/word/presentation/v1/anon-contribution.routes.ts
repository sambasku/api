import type { MiddlewareHandler } from 'hono';
import { createRoute } from '@hono/zod-openapi';
import { z } from 'zod';
import { createOpenApiApp } from '@/shared/openapi/openapi-app';
import { errorResponseSchema } from '@/shared/openapi/error-response.schema';
import { clientIpKey, rateLimit } from '@/shared/middlewares/rate-limit.middleware';
import type { AppVariables } from '@/shared/types';
import type { WordController } from './word.controller';
import {
  createWordBodySchema,
  createWordResponseSchema,
  variantRootRefine,
} from './validators/create-word.validator';
import {
  batchContributeWordsBodySchema,
  batchContributeWordsResponseSchema,
} from './validators/batch-contribute-words.validator';

const json = <T extends z.ZodType>(schema: T) => ({
  'application/json': { schema },
});

export interface AnonContributionRoutesDeps {
  controller: WordController;
  /** Auth opsional: Bearer valid → atribusi ke user login; tanpa token → anonim */
  optionalAuthenticate: MiddlewareHandler<{ Variables: AppVariables }>;
  /**
   * Gate azp + contribute.write jika Bearer ada.
   * Pakai allowMissingUser supaya anon tanpa token tetap lolos.
   */
  requireApprovedClient?: MiddlewareHandler<{ Variables: AppVariables }>;
}

// Body = create-word TANPA field status (dipaksa 'published' =
// kirim untuk direview; draft tidak bermakna di endpoint ini).
// Aturan variasi root (≠ lemma) diterapkan setelah .omit karena refine
// memutus .omit (11-api-variasi-penulisan.md).
const anonWordSchema = createWordBodySchema
  .omit({ status: true })
  .superRefine(variantRootRefine);

// POST /api/v1/contributions/words
// - Tanpa auth → user sistem Anonim (03-api-kontribusi-verifikasi.md)
// - Dengan Bearer → user login (bugfix: mobile kirim token tapi dulu
//   diabaikan karena createAnon hardcode ANONIM_USER_ID)
// POST /api/v1/contributions/words/batch - massal langsung tayang + sesi impor
export function createAnonContributionRoutes(deps: AnonContributionRoutesDeps) {
  const routes = createOpenApiApp();

  routes.use(
    '/words',
    deps.optionalAuthenticate,
    ...(deps.requireApprovedClient ? [deps.requireApprovedClient] : []),
  );
  routes.use(
    '/words/batch',
    deps.optionalAuthenticate,
    ...(deps.requireApprovedClient ? [deps.requireApprovedClient] : []),
    // Ketat: batch langsung tayang - 5 kiriman / jam per IP
    rateLimit({ points: 5, duration: 3600, keyFn: (c) => `contrib-batch:${clientIpKey(c)}` }),
  );

  const submitRoute = createRoute({
    method: 'post',
    path: '/words',
    tags: ['Contributions'],
    summary:
      'Submit kata (publik). Tanpa login → anonim; dengan Bearer → atribusi user login',
    request: {
      body: { content: json(anonWordSchema) },
    },
    responses: {
      201: {
        description: 'Kontribusi tersimpan (selalu pending_review untuk non-verifier)',
        content: json(createWordResponseSchema),
      },
      400: {
        description: 'Body tidak valid / referensi id tidak ditemukan',
        content: json(errorResponseSchema),
      },
      401: {
        description: 'Bearer ada tapi invalid/expired',
        content: json(errorResponseSchema),
      },
      409: {
        description: 'Lemma + makna exact sudah tayang - arahkan ke duplicate-confirm',
        content: json(errorResponseSchema),
      },
    },
  });

  const batchRoute = createRoute({
    method: 'post',
    path: '/words/batch',
    tags: ['Contributions'],
    summary:
      'Submit massal (publik). Langsung tayang, tercatat di riwayat impor. Nama opsional → support_name.',
    request: {
      body: { content: json(batchContributeWordsBodySchema) },
    },
    responses: {
      201: {
        description: 'Batch tersimpan + sesi impor',
        content: json(batchContributeWordsResponseSchema),
      },
      400: {
        description: 'Body tidak valid / referensi belum siap',
        content: json(errorResponseSchema),
      },
      401: {
        description: 'Bearer ada tapi invalid/expired',
        content: json(errorResponseSchema),
      },
      429: {
        description: 'Rate limit',
        content: json(errorResponseSchema),
      },
    },
  });

  // /words/batch sebelum /words agar tidak tertelan (bila ada path param nanti)
  routes.openapi(batchRoute, (c) =>
    deps.controller.batchContributeWords(c, c.req.valid('json')) as never,
  );
  routes.openapi(submitRoute, (c) => deps.controller.createAnon(c, c.req.valid('json')) as never);

  return routes;
}
