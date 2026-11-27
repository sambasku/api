import { createRoute, z } from '@hono/zod-openapi';
import type { Context, MiddlewareHandler } from 'hono';
import { bodyLimit } from 'hono/body-limit';
import type { AppVariables } from '@/shared/types';
import { authorizeRole } from '@/shared/middlewares/authorize-role.middleware';
import { rateLimit } from '@/shared/middlewares/rate-limit.middleware';
import { createOpenApiApp } from '@/shared/openapi/openapi-app';
import { errorResponseSchema } from '@/shared/openapi/error-response.schema';
import { ValidationError } from '@/shared/errors/app-error';
import {
  AdminExploreCommentService,
  EXPLORE_COMMENT_MODULES,
  type ExploreCommentModule,
} from '../../infrastructure/admin-explore-comment.service';

export interface AdminExploreCommentRoutesDeps {
  service: AdminExploreCommentService;
  authenticate: MiddlewareHandler;
}

const json = <T extends z.ZodTypeAny>(schema: T) => ({
  'application/json': { schema },
});

const moduleEnum = z.enum(EXPLORE_COMMENT_MODULES);

const listQuerySchema = z.object({
  module: moduleEnum.default('place'),
  status: z.enum(['published', 'taken_down', 'deleted_by_author']).optional(),
  has_media: z.enum(['image', 'audio', 'any']).optional(),
  q: z.string().trim().max(100).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(25),
  cursor: z.string().min(1).max(64).optional(),
});

const moduleIdParamsSchema = z.object({
  module: moduleEnum,
  id: z.string().min(1).max(64),
});

const rejectImageBodySchema = z
  .object({
    abusive: z.boolean().optional(),
  })
  .optional();

const itemSchema = z.object({
  id: z.string(),
  module: moduleEnum,
  target_id: z.string(),
  target_name: z.string(),
  target_slug: z.string(),
  user_id: z.string(),
  author_username: z.string().nullable(),
  author_display_name: z.string().nullable(),
  body: z.string(),
  body_original: z.string().nullable(),
  is_censored: z.boolean(),
  status: z.enum(['published', 'taken_down', 'deleted_by_author']),
  audio_url: z.string().nullable(),
  audio_mime_type: z.string().nullable(),
  audio_duration_ms: z.number().int().nullable(),
  image: z
    .object({
      status: z.enum(['pending_review', 'published', 'rejected']),
      url: z.string().nullable(),
      public_url: z.string().nullable(),
      content_warnings: z.array(z.string()),
    })
    .nullable(),
  created_at: z.string(),
  updated_at: z.string().nullable(),
});

const listResponseSchema = z.object({
  success: z.literal(true),
  data: z.object({
    items: z.array(itemSchema),
    next_cursor: z.string().nullable(),
    has_more: z.boolean(),
  }),
});

const takedownResponseSchema = z.object({
  success: z.literal(true),
  data: z.object({
    id: z.string(),
    status: z.literal('taken_down'),
  }),
});

const censorImageResponseSchema = z.object({
  success: z.literal(true),
  data: z.object({
    id: z.string(),
    image_public_url: z.string(),
    content_warnings: z.array(z.string()),
  }),
});

const rejectImageResponseSchema = z.object({
  success: z.literal(true),
  data: z.object({
    id: z.string(),
    image_status: z.literal('rejected'),
  }),
});

async function parseCensorImageBody(c: Context<{ Variables: AppVariables }>): Promise<{
  censoredBytes?: Uint8Array | null;
  censoredMimeType?: string | null;
  contentWarnings?: string[] | null;
}> {
  const ct = (c.req.header('content-type') ?? '').toLowerCase();
  if (ct.includes('multipart/form-data')) {
    const form = await c.req.formData();
    const rawWarnings = form.get('content_warnings');
    let contentWarnings: string[] | null = null;
    if (typeof rawWarnings === 'string' && rawWarnings.trim().length > 0) {
      try {
        contentWarnings = JSON.parse(rawWarnings) as string[];
      } catch {
        throw new ValidationError([
          { field: 'content_warnings', message: 'content_warnings harus berupa JSON array' },
        ]);
      }
    }
    const file = form.get('image');
    if (file instanceof File && file.size > 0) {
      return {
        censoredBytes: new Uint8Array(await file.arrayBuffer()),
        censoredMimeType: file.type || null,
        contentWarnings,
      };
    }
    return { contentWarnings };
  }

  if (ct.includes('application/json')) {
    const body = (await c.req.json().catch(() => ({}))) as {
      content_warnings?: string[];
    };
    return { contentWarnings: body.content_warnings ?? null };
  }

  return {};
}

export function createAdminExploreCommentRoutes(deps: AdminExploreCommentRoutesDeps) {
  const routes = createOpenApiApp();

  const reviewer = [
    deps.authenticate,
    authorizeRole('root', 'admin', 'reviewer', 'editor'),
    rateLimit({ points: 500, duration: 60 }),
  ];

  routes.use('/', ...reviewer);
  routes.use('/:module/:id/takedown', ...reviewer);
  routes.use(
    '/:module/:id/censor-image',
    ...reviewer,
    bodyLimit({ maxSize: 6 * 1024 * 1024 }),
  );
  routes.use('/:module/:id/reject-image', ...reviewer);

  const listRoute = createRoute({
    method: 'get',
    path: '/',
    tags: ['Admin', 'Comments'],
    summary: 'List komentar eksplorasi untuk moderasi admin (6 modul)',
    security: [{ Bearer: [] }],
    request: { query: listQuerySchema },
    responses: {
      200: { description: 'OK', content: json(listResponseSchema) },
      403: { description: 'Bukan reviewer/admin', content: json(errorResponseSchema) },
    },
  });

  const takedownRoute = createRoute({
    method: 'post',
    path: '/:module/:id/takedown',
    tags: ['Admin', 'Comments'],
    summary: 'Takedown komentar eksplorasi',
    security: [{ Bearer: [] }],
    request: { params: moduleIdParamsSchema },
    responses: {
      200: { description: 'Di-takedown', content: json(takedownResponseSchema) },
      404: { description: 'Tidak ditemukan', content: json(errorResponseSchema) },
      409: { description: 'Bukan published', content: json(errorResponseSchema) },
    },
  });

  const censorImageRoute = createRoute({
    method: 'post',
    path: '/:module/:id/censor-image',
    tags: ['Admin', 'Comments'],
    summary: 'Sensor atau perbarui warning foto komentar eksplorasi (post-moderation)',
    security: [{ Bearer: [] }],
    request: { params: moduleIdParamsSchema },
    responses: {
      200: { description: 'Foto tersensor', content: json(censorImageResponseSchema) },
      404: { description: 'Tidak ditemukan', content: json(errorResponseSchema) },
      409: { description: 'Foto tidak tersedia', content: json(errorResponseSchema) },
    },
  });

  const rejectImageRoute = createRoute({
    method: 'post',
    path: '/:module/:id/reject-image',
    tags: ['Admin', 'Comments'],
    summary: 'Turunkan foto komentar eksplorasi (teks tetap tayang)',
    security: [{ Bearer: [] }],
    request: {
      params: moduleIdParamsSchema,
      body: { content: json(rejectImageBodySchema), required: false },
    },
    responses: {
      200: { description: 'Foto diturunkan', content: json(rejectImageResponseSchema) },
      404: { description: 'Tidak ditemukan', content: json(errorResponseSchema) },
      409: { description: 'Foto tidak tersedia', content: json(errorResponseSchema) },
    },
  });

  routes.openapi(listRoute, async (c) => {
    const q = c.req.valid('query');
    const page = await deps.service.list({
      module: q.module as ExploreCommentModule,
      status: q.status,
      hasMedia: q.has_media,
      q: q.q,
      limit: q.limit,
      cursor: q.cursor,
    });
    return c.json({ success: true as const, data: page }, 200);
  });

  routes.openapi(takedownRoute, async (c) => {
    const { module, id } = c.req.valid('param');
    const user = c.get('user')!;
    const data = await deps.service.takedown({
      module,
      commentId: id,
      actorId: user.user_id,
      requestId: c.get('requestId') ?? null,
    });
    return c.json({ success: true as const, data }, 200);
  });

  routes.openapi(censorImageRoute, async (c) => {
    const { module, id } = c.req.valid('param');
    const user = c.get('user')!;
    const body = await parseCensorImageBody(c);
    const data = await deps.service.censorImage({
      module,
      commentId: id,
      actorId: user.user_id,
      censoredBytes: body.censoredBytes,
      censoredMimeType: body.censoredMimeType,
      contentWarnings: body.contentWarnings,
      requestId: c.get('requestId') ?? null,
    });
    return c.json({ success: true as const, data }, 200);
  });

  routes.openapi(rejectImageRoute, async (c) => {
    const { module, id } = c.req.valid('param');
    const user = c.get('user')!;
    let abusive = false;
    try {
      const body = (await c.req.json()) as { abusive?: boolean };
      abusive = body?.abusive === true;
    } catch {
      // Body kosong valid.
    }
    const data = await deps.service.rejectImage({
      module,
      commentId: id,
      actorId: user.user_id,
      abusive,
      requestId: c.get('requestId') ?? null,
    });
    return c.json({ success: true as const, data }, 200);
  });

  return routes;
}
