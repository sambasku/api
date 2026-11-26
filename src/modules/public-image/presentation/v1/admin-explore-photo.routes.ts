import { createRoute, z } from '@hono/zod-openapi';
import type { MiddlewareHandler } from 'hono';
import { bodyLimit } from 'hono/body-limit';
import { authorizeRole } from '@/shared/middlewares/authorize-role.middleware';
import { rateLimit } from '@/shared/middlewares/rate-limit.middleware';
import { createOpenApiApp } from '@/shared/openapi/openapi-app';
import { errorResponseSchema } from '@/shared/openapi/error-response.schema';
import { ValidationError } from '@/shared/errors/app-error';
import {
  AdminExplorePhotoService,
  EXPLORE_PHOTO_MODULES,
  type ExplorePhotoModule,
} from '../../infrastructure/admin-explore-photo.service';

export interface AdminExplorePhotoRoutesDeps {
  service: AdminExplorePhotoService;
  authenticate: MiddlewareHandler;
}

const json = <T extends z.ZodType>(schema: T) => ({
  'application/json': { schema },
});

const moduleEnum = z.enum(EXPLORE_PHOTO_MODULES);

const paramsSchema = z.object({
  module: moduleEnum,
  entityId: z.string().min(1).max(64),
});

const takedownBodySchema = z.object({
  image_id: z.string().min(1).max(64).optional(),
  image_url: z.string().url().optional(),
});

const takedownResponseSchema = z.object({
  success: z.literal(true),
  data: z.object({ url: z.string() }),
});

const censorResponseSchema = z.object({
  success: z.literal(true),
  data: z.object({ old_url: z.string(), url: z.string() }),
});

export function createAdminExplorePhotoRoutes(deps: AdminExplorePhotoRoutesDeps) {
  const routes = createOpenApiApp();

  const mod = [
    deps.authenticate,
    authorizeRole('root', 'admin', 'reviewer', 'editor'),
    rateLimit({ points: 120, duration: 60 }),
  ] as const;

  routes.use('/:module/:entityId/takedown', ...mod);
  routes.use(
    '/:module/:entityId/censor',
    ...mod,
    bodyLimit({ maxSize: 6 * 1024 * 1024 }),
  );

  const takedownRoute = createRoute({
    method: 'post',
    path: '/:module/:entityId/takedown',
    tags: ['Admin', 'Explore'],
    summary: 'Takedown foto galeri eksplorasi (post-upload)',
    security: [{ Bearer: [] }],
    request: {
      params: paramsSchema,
      body: { content: json(takedownBodySchema) },
    },
    responses: {
      200: { description: 'Foto diturunkan', content: json(takedownResponseSchema) },
      404: { description: 'Tidak ditemukan', content: json(errorResponseSchema) },
    },
  });

  const censorRoute = createRoute({
    method: 'post',
    path: '/:module/:entityId/censor',
    tags: ['Admin', 'Explore'],
    summary: 'Sensor foto galeri eksplorasi (multipart: image + image_id/image_url)',
    security: [{ Bearer: [] }],
    request: { params: paramsSchema },
    responses: {
      200: { description: 'Foto tersensor', content: json(censorResponseSchema) },
      400: { description: 'Input tidak valid', content: json(errorResponseSchema) },
      404: { description: 'Tidak ditemukan', content: json(errorResponseSchema) },
    },
  });

  routes.openapi(takedownRoute, async (c) => {
    const { module, entityId } = c.req.valid('param');
    const body = c.req.valid('json');
    const user = c.get('user')!;
    const data = await deps.service.takedown({
      module: module as ExplorePhotoModule,
      entityId,
      imageId: body.image_id,
      imageUrl: body.image_url,
      actorId: user.user_id,
      requestId: c.get('requestId') ?? null,
    });
    return c.json({ success: true as const, data }, 200);
  });

  routes.openapi(censorRoute, async (c) => {
    const { module, entityId } = c.req.valid('param');
    const user = c.get('user')!;
    const form = await c.req.formData();
    const file = form.get('image');
    if (!(file instanceof File) || file.size === 0) {
      throw new ValidationError([{ field: 'image', message: 'File gambar tersensor wajib dikirim' }]);
    }
    const imageId = typeof form.get('image_id') === 'string' ? String(form.get('image_id')) : null;
    const imageUrl =
      typeof form.get('image_url') === 'string' ? String(form.get('image_url')) : null;

    const data = await deps.service.censor({
      module: module as ExplorePhotoModule,
      entityId,
      imageId,
      imageUrl,
      censoredBytes: new Uint8Array(await file.arrayBuffer()),
      censoredMimeType: file.type || null,
      actorId: user.user_id,
      requestId: c.get('requestId') ?? null,
    });
    return c.json({ success: true as const, data }, 200);
  });

  return routes;
}
