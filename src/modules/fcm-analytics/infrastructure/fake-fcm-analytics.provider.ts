import type { FcmAnalyticsProvider } from '../application/ports/fcm-analytics.port';
import { addDays } from '@/modules/web-analytics/domain/date-range';
import type { DateRange, ResolvedRange } from '@/modules/web-analytics/domain/entities/web-analytics.entity';
import type {
  FcmDelivery,
  FcmEngagement,
  FcmTotals,
  FcmTrendPoint,
} from '../domain/entities/fcm-analytics.entity';

/**
 * Data palsu deterministik untuk preview UI analitik notifikasi lokal tanpa
 * kredensial (`WEB_ANALYTICS_FAKE=true`, diabaikan di production) dan fixture
 * test.
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

function trend(range: DateRange): FcmTrendPoint[] {
  return eachDay(range).map((date) => {
    const sent = wave(date, 32);
    return { date, sent, delivered: Math.round(sent * 0.94), opened: Math.round(sent * 0.21) };
  });
}

function totals(points: FcmTrendPoint[]): FcmTotals {
  const sum = (k: 'sent' | 'delivered' | 'opened') => points.reduce((s, p) => s + p[k], 0);
  const sent = sum('sent');
  const delivered = sum('delivered');
  return { sent, delivered, failed: Math.max(0, sent - delivered), opened: sum('opened'), openRate: delivered > 0 ? sum('opened') / delivered : 0 };
}

export class FakeFcmAnalyticsProvider implements FcmAnalyticsProvider {
  isConfigured(): boolean {
    return true;
  }

  async getDelivery(range: ResolvedRange): Promise<FcmDelivery> {
    return {
      totals: totals(trend(range.current)),
      previous: totals(trend(range.previous)),
      trend: trend(range.current),
      latestDataDate: range.current.end,
    };
  }

  async getEngagement(range: ResolvedRange): Promise<FcmEngagement> {
    const delivery = await this.getDelivery(range);
    return { ...delivery, avgEngagementSeconds: 17 };
  }
}
