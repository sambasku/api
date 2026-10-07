import type { MiddlewareHandler } from 'hono';
import { createRoute } from '@hono/zod-openapi';
import { z } from 'zod';
import { authorizeRole } from '@/shared/middlewares/authorize-role.middleware';
import { clientIpKey, rateLimit } from '@/shared/middlewares/rate-limit.middleware';
import { createOpenApiApp } from '@/shared/openapi/openapi-app';
import { errorResponseSchema } from '@/shared/openapi/error-response.schema';
import type { AppVariables } from '@/shared/types';
import type { CategorySuggestionController } from './category-suggestion.controller';
import {
  ListCategorySuggestionsQuerySchema,
  ProposeCategorySuggestionSchema,
  ReviewCategorySuggestionSchema,
} from './category-suggestion.dtos';

const json = <T extends z.ZodType>(schema: T) => ({
  'application/json': { schema },
});

/** Bentuk data = toApi() di controller (kontrak wire api#50). */
const categorySuggestionItemSchema = z.object({
  id: z.string(),
  name: z.string(),
  reason: z.string().nullable(),
  status: z.string(),
  proposed_by: z.string().nullable(),
  contributor_name: z.string().nullable(),
  reviewed_at: z.string().nullable(),
  reject_reason: z.string().nullable(),
  created_at: z.string(),
});
const okItemSchema = z.object({ success: z.literal(true), data: categorySuggestionItemSchema });
const okListSchema = z.object({
  success: z.literal(true),
  data: z.array(categorySuggestionItemSchema),
});

export interface CategorySuggestionRoutesDeps {
  controller: CategorySuggestionController;
}

export interface AdminCategorySuggestionRoutesDeps {
  controller: CategorySuggestionController;
  authenticate: MiddlewareHandler<{ Variables: AppVariables }>;
}

// POST /api/v1/category-suggestions - usul kategori baru (publik).
// Pola anon-contribution: login ATAU anonim; tamu rate limit 3/jam per IP,
// user login lolos limit (gate moderasi tetap berlaku untuk semua).
export function createCategorySuggestionRoutes(
  deps: CategorySuggestionRoutesDeps & {
    optionalAuthenticate: MiddlewareHandler<{ Variables: AppVariables }>;
  },
) {
  const routes = createOpenApiApp();
  const submitIpLimit = rateLimit({
    points: 3,
    duration: 3600,
    keyFn: (c) => `category-suggestion:ip:${clientIpKey(c)}`,
  });

  routes.use('/', deps.optionalAuthenticate);
  routes.use('/', async (c, next) => {
    if (c.req.method !== 'POST') return next();
    if (c.get('user')?.user_id) return next();
    return submitIpLimit(c, next);
  });

  const proposeRoute = createRoute({
    method: 'post',
    path: '/',
    tags: ['Category Suggestions'],
    summary:
      'Usul kategori baru (publik) - tanpa login boleh (isi contributor_name), dengan Bearer atribusi user login. Selalu antre moderasi.',
    request: { body: { content: json(ProposeCategorySuggestionSchema) } },
    responses: {
      201: { description: 'Usulan tersimpan (pending)', content: json(okItemSchema) },
      400: { description: 'Body tidak valid / nama kategori sudah ada', content: json(errorResponseSchema) },
      401: { description: 'Bearer ada tapi invalid/expired', content: json(errorResponseSchema) },
    },
  });

  routes.openapi(proposeRoute, (c) =>
    deps.controller.propose(c, c.req.valid('json')) as never,
  );

  return routes;
}

// Panel moderasi: GET /api/v1/admin/category-suggestions (antrean) +
// PATCH /:id/review (approve/reject). Verifikator (root/admin/reviewer).
export function createAdminCategorySuggestionRoutes(
  deps: AdminCategorySuggestionRoutesDeps,
) {
  const routes = createOpenApiApp();
  routes.use(
    '*',
    deps.authenticate,
    authorizeRole('root', 'admin', 'reviewer'),
    rateLimit({ points: 500, duration: 60 }),
  );

  const listRoute = createRoute({
    method: 'get',
    path: '/',
    tags: ['Category Suggestions', 'Admin'],
    summary: 'Antrean moderasi usulan kategori (pending/approved/rejected)',
    request: { query: ListCategorySuggestionsQuerySchema },
    responses: {
      200: { description: 'Daftar usulan', content: json(okListSchema) },
      400: { description: 'Query tidak valid', content: json(errorResponseSchema) },
      401: { description: 'Token tidak ada/invalid', content: json(errorResponseSchema) },
      403: { description: 'Role tidak diizinkan', content: json(errorResponseSchema) },
    },
  });

  const reviewRoute = createRoute({
    method: 'patch',
    path: '/:id/review',
    tags: ['Category Suggestions', 'Admin'],
    summary: 'Moderasi usulan: approve (masuk master kategori) / reject (dengan alasan)',
    request: {
      params: z.object({ id: z.string().min(1) }),
      body: { content: json(ReviewCategorySuggestionSchema) },
    },
    responses: {
      200: { description: 'Usulan direview', content: json(okItemSchema) },
      400: { description: 'Body tidak valid / reject tanpa alasan', content: json(errorResponseSchema) },
      401: { description: 'Token tidak ada/invalid', content: json(errorResponseSchema) },
      403: { description: 'Role tidak diizinkan', content: json(errorResponseSchema) },
      404: { description: 'Usulan tidak ditemukan', content: json(errorResponseSchema) },
      409: { description: 'Sudah direview / nama bentrok', content: json(errorResponseSchema) },
    },
  });

  routes.openapi(listRoute, (c) => deps.controller.list(c, c.req.valid('query')) as never);
  routes.openapi(reviewRoute, (c) =>
    deps.controller.review(c, c.req.valid('param').id, c.req.valid('json')) as never,
  );

  return routes;
}
