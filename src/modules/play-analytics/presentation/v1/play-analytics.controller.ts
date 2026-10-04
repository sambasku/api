import type { Context } from 'hono';
import type { GetPlayAnalyticsUseCase } from '../../application/use-cases/get-play-analytics.use-case';
import type { PlayAnalyticsSection } from '../../domain/entities/play-analytics.entity';
import type { PlayAnalyticsQuery } from './validators/play-analytics.validator';

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

export class PlayAnalyticsController {
  constructor(private readonly deps: { getReport: GetPlayAnalyticsUseCase }) {}

  async report(c: Context, section: PlayAnalyticsSection, query: PlayAnalyticsQuery) {
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
