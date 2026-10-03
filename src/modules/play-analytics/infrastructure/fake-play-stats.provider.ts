import type { PlayStatsProvider } from '../application/ports/play-analytics.port';
import { addDays } from '@/modules/web-analytics/domain/date-range';
import type { DateRange, ResolvedRange } from '@/modules/web-analytics/domain/entities/web-analytics.entity';
import type {
  PlayGrowth,
  PlayOverview,
  PlayRatings,
} from '../domain/entities/play-analytics.entity';

/**
 * Data palsu deterministik untuk preview UI Play Store lokal tanpa export
 * GCS (`WEB_ANALYTICS_FAKE=true`, diabaikan di production) dan fixture test.
 */

function eachDay(range: DateRange): string[] {
  const out: string[] = [];
  for (let d = range.start; d <= range.end; d = addDays(d, 1)) out.push(d);
  return out;
}

function wave(date: string, base: number): number {
  const day = Date.parse(`${date}T00:00:00Z`) / 86_400_000;
  return Math.max(0, Math.round(base * (1 + 0.3 * Math.sin((day * 2 * Math.PI) / 7) + (day % 97) / 300)));
}

function dayInstalls(date: string): number {
  return wave(date, 18);
}

function dayUninstalls(date: string): number {
  return Math.max(1, Math.round(dayInstalls(date) * 0.18));
}

function totals(range: DateRange) {
  const days = eachDay(range);
  const installs = days.reduce((s, d) => s + dayInstalls(d), 0);
  const uninstalls = days.reduce((s, d) => s + dayUninstalls(d), 0);
  return {
    newInstalls: installs,
    uninstalls,
    updates: Math.round(installs * 0.35),
    // Kumulatif: nilai akhir rentang naik dari awal rentang.
    activeInstalls: 4200 + days.length,
    averageRating: 4.36,
    ratingCount: 128,
  };
}

export class FakePlayStatsProvider implements PlayStatsProvider {
  isConfigured(): boolean {
    return true;
  }

  async getOverview(range: ResolvedRange): Promise<PlayOverview> {
    const trend = eachDay(range.current).map((date) => ({
      date,
      installs: dayInstalls(date),
      uninstalls: dayUninstalls(date),
    }));
    return {
      totals: totals(range.current),
      previous: totals(range.previous),
      trend,
      topCountries: [
        { country: 'ID', installs: Math.round(totals(range.current).newInstalls * 0.92) },
        { country: 'MY', installs: Math.round(totals(range.current).newInstalls * 0.04) },
        { country: 'SG', installs: Math.round(totals(range.current).newInstalls * 0.02) },
        { country: 'US', installs: Math.round(totals(range.current).newInstalls * 0.01) },
      ],
    };
  }

  async getGrowth(range: ResolvedRange): Promise<PlayGrowth> {
    const base = await this.getOverview(range);
    return {
      ...base,
      netTrend: base.trend.map((p) => ({ date: p.date, net: p.installs - p.uninstalls })),
    };
  }

  async getRatings(range: ResolvedRange): Promise<PlayRatings> {
    return {
      totals: totals(range.current),
      previous: totals(range.previous),
      // ponytail: distribusi bintang palsu; export CSV tidak menyediakan - sumber asli = Reporting API
      buckets: [
        { stars: 5, count: 86, share: 0.672 },
        { stars: 4, count: 24, share: 0.188 },
        { stars: 3, count: 9, share: 0.07 },
        { stars: 2, count: 4, share: 0.031 },
        { stars: 1, count: 5, share: 0.039 },
      ],
    };
  }
}
