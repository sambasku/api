import type { Context } from 'hono';
import type { GetWebAnalyticsUseCase } from '../../application/use-cases/get-web-analytics.use-case';
import type { WebAnalyticsSection } from '../../domain/entities/web-analytics.entity';
import type { WebAnalyticsQuery } from './validators/web-analytics.validator';

/** camelCase -> snake_case rekursif untuk key objek (nilai string tidak disentuh). */
export function toSnakeKeys(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(toSnakeKeys);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([k, v]) => [k.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`), toSnakeKeys(v)]),
    );
  }
  return value;
}

export class WebAnalyticsController {
  constructor(private readonly deps: { getReport: GetWebAnalyticsUseCase }) {}

  async report(c: Context, section: WebAnalyticsSection, query: WebAnalyticsQuery) {
    const filters = query.page || query.query ? { page: query.page, query: query.query } : undefined;
    const report = await this.deps.getReport.execute({
      section,
      range: query.range,
      start: query.start,
      end: query.end,
      filters,
    });
    // Entitas camelCase -> kontrak wire snake_case (konvensi endpoint admin).
    return c.json({ success: true as const, data: toSnakeKeys(report) });
  }
}
