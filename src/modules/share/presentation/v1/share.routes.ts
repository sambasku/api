import { createRoute } from '@hono/zod-openapi';
import { z } from 'zod';
import { rateLimit } from '@/shared/middlewares/rate-limit.middleware';
import { createOpenApiApp } from '@/shared/openapi/openapi-app';
import { errorResponseSchema } from '@/shared/openapi/error-response.schema';
import type { ShareController } from './share.controller';
import {
  listShareBackgroundProvidersResponseSchema,
  listShareBackgroundsQuerySchema,
  listShareBackgroundsResponseSchema,
  trackUnsplashDownloadBodySchema,
  trackUnsplashDownloadResponseSchema,
} from './validators/share-backgrounds.validator';

const json = <T extends z.ZodType>(schema: T) => ({
  'application/json': { schema },
});

/** GET /api/v1/share/backgrounds - proxy latar multi-provider. */
export function createShareRoutes(deps: { controller: ShareController }) {
  const routes = createOpenApiApp();
  routes.use('*', rateLimit({ points: 30, duration: 60 }));

  const backgroundsRoute = createRoute({
    method: 'get',
    path: '/backgrounds',
    tags: ['Share'],
    summary: 'Cari foto atau video latar untuk kartu share',
    description:
      'Default `provider=pixabay`, `media=photo`. `sort=relevant` butuh `q`. ' +
      '`sort=popular` untuk Media Explorer (q opsional). ' +
      '`limit` 1-30 (default 3). `media=video` hanya `pixabay`. ' +
      'Safe search always-on; Openverse dibatasi lisensi CC. ' +
      'Tanpa konfigurasi / gagal upstream → items kosong + degraded:true.',
    request: { query: listShareBackgroundsQuerySchema },
    responses: {
      200: {
        description: 'Daftar kandidat latar (boleh kosong)',
        content: json(listShareBackgroundsResponseSchema),
      },
      400: { description: 'Query tidak valid', content: json(errorResponseSchema) },
      429: { description: 'Rate limit', content: json(errorResponseSchema) },
    },
  });

  const providersRoute = createRoute({
    method: 'get',
    path: '/background-providers',
    tags: ['Share'],
    summary: 'Daftar provider latar yang didukung',
    responses: {
      200: {
        description: 'Daftar provider',
        content: json(listShareBackgroundProvidersResponseSchema),
      },
      429: { description: 'Rate limit', content: json(errorResponseSchema) },
    },
  });

  const trackUnsplashDownloadRoute = createRoute({
    method: 'post',
    path: '/backgrounds/unsplash/download',
    tags: ['Share'],
    summary: 'Catat download foto Unsplash yang dipilih user',
    description:
      'Wajib menurut Unsplash API Guidelines: dipanggil saat user memilih foto ' +
      'Unsplash di Media Explorer. Proxy ke `GET /photos/{id}/download` ' +
      '(Access Key tetap di server). `tracked:false` bila kunci belum di-set ' +
      'atau upstream gagal.',
    request: { body: { content: json(trackUnsplashDownloadBodySchema) } },
    responses: {
      200: {
        description: 'Hasil pelacakan',
        content: json(trackUnsplashDownloadResponseSchema),
      },
      400: { description: 'ID foto tidak valid', content: json(errorResponseSchema) },
      429: { description: 'Rate limit', content: json(errorResponseSchema) },
    },
  });

  routes.openapi(trackUnsplashDownloadRoute, (c) => {
    const { id } = c.req.valid('json');
    return deps.controller.trackUnsplashDownload(c, id) as never;
  });

  routes.openapi(backgroundsRoute, (c) => {
    const { q, page, sort, provider, limit, media, orientation } = c.req.valid('query');
    return deps.controller.backgrounds(
      c,
      q,
      page,
      sort,
      provider,
      limit,
      media,
      orientation,
    ) as never;
  });

  routes.openapi(providersRoute, (c) => deps.controller.providers(c) as never);

  return routes;
}
