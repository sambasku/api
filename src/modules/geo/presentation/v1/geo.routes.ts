import { createRoute } from '@hono/zod-openapi';
import type { z } from 'zod';
import {
  clientIpKey,
  rateLimit,
} from '@/shared/middlewares/rate-limit.middleware';
import { createOpenApiApp } from '@/shared/openapi/openapi-app';
import { errorResponseSchema } from '@/shared/openapi/error-response.schema';
import type { GeoController } from './geo.controller';
import {
  resolveMapsUrlBodySchema,
  resolveMapsUrlResponseSchema,
} from './validators/geo.validator';

const json = <T extends z.ZodType>(schema: T) => ({
  'application/json': { schema },
});

/**
 * POST /api/v1/geo/resolve-maps-url
 * Publik + rate limit IP (form usulan boleh anon). Tanpa Places API.
 */
export function createGeoRoutes(deps: { controller: GeoController }) {
  const routes = createOpenApiApp();

  routes.use(
    '*',
    rateLimit({
      points: 20,
      duration: 60,
      keyFn: (c) => `geo-maps:${clientIpKey(c)}`,
    }),
  );

  const resolveRoute = createRoute({
    method: 'post',
    path: '/resolve-maps-url',
    tags: ['Geo'],
    summary: 'Ubah tautan Google Maps jadi koordinat (Kabupaten Sambas)',
    description:
      'Terima tautan share Maps (`maps.app.goo.gl`, `google.com/maps`, …). ' +
      'Short link diikuti redirect (allowlist host). Koordinat di luar ' +
      'Kabupaten Sambas ditolak. Tidak memakai Google Places API.',
    request: {
      body: { content: json(resolveMapsUrlBodySchema), required: true },
    },
    responses: {
      200: {
        description: 'Koordinat + URL kanonis',
        content: json(resolveMapsUrlResponseSchema),
      },
      400: {
        description:
          'MAPS_URL_INVALID / MAPS_URL_NO_COORDS / MAPS_URL_OUT_OF_BOUNDS / MAPS_URL_RESOLVE_FAILED / VALIDATION_ERROR',
        content: json(errorResponseSchema),
      },
      429: { description: 'Rate limit', content: json(errorResponseSchema) },
    },
  });

  routes.openapi(resolveRoute, (c) =>
    deps.controller.resolveMapsUrl(c, c.req.valid('json')) as never,
  );

  return routes;
}
