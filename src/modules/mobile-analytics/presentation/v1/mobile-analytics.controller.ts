import type { Context } from 'hono';
import type { GetMobileAnalyticsUseCase } from '../../application/use-cases/get-mobile-analytics.use-case';
import type { MobileAnalyticsSection } from '../../domain/entities/mobile-analytics.entity';
import type { MobileAnalyticsQuery } from './validators/mobile-analytics.validator';
export function toSnakeKeys(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(toSnakeKeys);
  if (value && typeof value === 'object' && value !== null) {
    return Object.fromEntries(
      Object.entries(value).map(([k, v]) => [k.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`), toSnakeKeys(v)]),
    );
  }
  return value;
}
export class MobileAnalyticsController {
  constructor(private readonly deps: { getReport: GetMobileAnalyticsUseCase }) {}
  async report(c: Context, section: MobileAnalyticsSection, query: MobileAnalyticsQuery) {
    const report = await this.deps.getReport.execute({
      section,
      range: query.range,
      start: query.start,
      end: query.end,
    });
    return c.json({ success: true as const, data: toSnakeKeys(report) });
  }
}