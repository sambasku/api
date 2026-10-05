import type { Context } from 'hono';
import type { GetFcmAnalyticsUseCase } from '../../application/use-cases/get-fcm-analytics.use-case';
import type { FcmAnalyticsSection } from '../../domain/entities/fcm-analytics.entity';
import type { FcmAnalyticsQuery } from './validators/fcm-analytics.validator';

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

export class FcmAnalyticsController {
  constructor(private readonly deps: { getReport: GetFcmAnalyticsUseCase }) {}

  async report(c: Context, section: FcmAnalyticsSection, query: FcmAnalyticsQuery) {
    const report = await this.deps.getReport.execute({
      section,
      range: query.range,
      start: query.start,
      end: query.end,
    });
    // Entitas camelCase -> kontrak wire snake_case (konvensi endpoint admin).
    return c.json({ success: true as const, data: toSnakeKeys(report) });
  }
}
