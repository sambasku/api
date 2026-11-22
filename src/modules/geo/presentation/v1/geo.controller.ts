import type { Context } from 'hono';
import type { ResolveMapsUrlUseCase } from '../../application/resolve-maps-url.use-case';
import type { ResolveMapsUrlBody } from './validators/geo.validator';

export class GeoController {
  constructor(private readonly deps: { resolveMapsUrl: ResolveMapsUrlUseCase }) {}

  async resolveMapsUrl(c: Context, body: ResolveMapsUrlBody) {
    const data = await this.deps.resolveMapsUrl.execute(body.url, {
      requireSambasBounds: body.require_sambas_bounds === true,
    });
    return c.json({ success: true as const, data });
  }
}
