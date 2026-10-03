import type {
  SearchAnalyticsProvider,
  VisitorAnalyticsProvider,
} from '../application/ports/analytics-provider.port';
import { addDays } from '../domain/date-range';
import type {
  DateRange,
  Ga4Behavior,
  Ga4Overview,
  Ga4Sources,
  Ga4Totals,
  Ga4TrendPoint,
  Ga4Visitors,
  ResolvedRange,
  SearchDetail,
  SearchOverview,
  SearchTrendPoint,
} from '../domain/entities/web-analytics.entity';

/**
 * Data palsu deterministik untuk preview UI lokal tanpa kredensial Google
 * (`WEB_ANALYTICS_FAKE=true`, diabaikan di production) dan fixture test.
 */

function eachDay(range: DateRange): string[] {
  const out: string[] = [];
  for (let d = range.start; d <= range.end; d = addDays(d, 1)) out.push(d);
  return out;
}

/** Gelombang mingguan + tren naik pelan, deterministik per tanggal. */
function wave(date: string, base: number): number {
  const day = Date.parse(`${date}T00:00:00Z`) / 86_400_000;
  return Math.round(base * (1 + 0.25 * Math.sin((day * 2 * Math.PI) / 7) + (day % 365) / 2000));
}

function ga4Trend(range: DateRange): Ga4TrendPoint[] {
  return eachDay(range).map((date) => {
    const activeUsers = wave(date, 120);
    return { date, activeUsers, sessions: Math.round(activeUsers * 1.4), pageViews: Math.round(activeUsers * 3.2) };
  });
}

function ga4Totals(range: DateRange): Ga4Totals {
  const trend = ga4Trend(range);
  const sum = (k: 'activeUsers' | 'sessions' | 'pageViews') => trend.reduce((s, p) => s + p[k], 0);
  return {
    activeUsers: sum('activeUsers'),
    totalUsers: Math.round(sum('activeUsers') * 1.1),
    newUsers: Math.round(sum('activeUsers') * 0.45),
    sessions: sum('sessions'),
    pageViews: sum('pageViews'),
    eventCount: Math.round(sum('pageViews') * 2.6),
    engagementRate: 0.58,
  };
}

const PAGES = ['/', '/kamus', '/kata/bagak', '/wisata', '/diskusi', '/kata/ngape', '/tentang'];

function scaled(range: DateRange): number {
  return ga4Totals(range).pageViews;
}

export class FakeVisitorAnalyticsProvider implements VisitorAnalyticsProvider {
  isConfigured(): boolean {
    return true;
  }

  async getOverview(range: ResolvedRange): Promise<Ga4Overview> {
    const views = scaled(range.current);
    return {
      totals: ga4Totals(range.current),
      previous: ga4Totals(range.previous),
      trend: ga4Trend(range.current),
      topPages: PAGES.slice(0, 5).map((path, i) => ({
        path,
        views: Math.round(views / (i + 2.2)),
        users: Math.round(views / (i + 3.4)),
      })),
    };
  }

  async getVisitors(range: ResolvedRange): Promise<Ga4Visitors> {
    const totals = ga4Totals(range.current);
    return {
      totals,
      previous: ga4Totals(range.previous),
      trend: ga4Trend(range.current),
      devices: [
        { key: 'mobile', users: Math.round(totals.totalUsers * 0.71), sessions: Math.round(totals.sessions * 0.7) },
        { key: 'desktop', users: Math.round(totals.totalUsers * 0.26), sessions: Math.round(totals.sessions * 0.27) },
        { key: 'tablet', users: Math.round(totals.totalUsers * 0.03), sessions: Math.round(totals.sessions * 0.03) },
      ],
      countries: [
        ['Indonesia', 0.86],
        ['Malaysia', 0.08],
        ['Singapore', 0.02],
        ['United States', 0.02],
        ['Netherlands', 0.01],
      ].map(([key, share]) => ({
        key: key as string,
        users: Math.round(totals.totalUsers * (share as number)),
        sessions: Math.round(totals.sessions * (share as number)),
      })),
    };
  }

  async getBehavior(range: ResolvedRange): Promise<Ga4Behavior> {
    const views = scaled(range.current);
    return {
      totals: ga4Totals(range.current),
      previous: ga4Totals(range.previous),
      topPages: PAGES.map((path, i) => ({
        path,
        views: Math.round(views / (i + 2.2)),
        users: Math.round(views / (i + 3.4)),
      })),
      landingPages: PAGES.slice(0, 5).map((path, i) => ({
        path,
        sessions: Math.round(views / (i + 4)),
        engagementRate: 0.7 - i * 0.06,
      })),
      events: ['page_view', 'session_start', 'search', 'word_open', 'share'].map((name, i) => ({
        name,
        count: Math.round(views / (i * 1.8 + 1)),
        users: Math.round(views / (i * 1.8 + 3)),
      })),
    };
  }

  async getSources(range: ResolvedRange): Promise<Ga4Sources> {
    const total = ga4Totals(range.current).sessions;
    const shares = [
      ['organic_search', 0.524],
      ['direct', 0.241],
      ['social', 0.124],
      ['referral', 0.072],
      ['other', 0.039],
    ] as const;
    return {
      totalSessions: total,
      channels: shares.map(([channel, share]) => ({ channel, sessions: Math.round(total * share), share })),
    };
  }
}

function searchTrend(range: DateRange): SearchTrendPoint[] {
  return eachDay(range).map((date) => {
    const impressions = wave(date, 900);
    return { date, impressions, clicks: Math.round(impressions * 0.045) };
  });
}

function searchTotals(range: DateRange) {
  const trend = searchTrend(range);
  const clicks = trend.reduce((s, p) => s + p.clicks, 0);
  const impressions = trend.reduce((s, p) => s + p.impressions, 0);
  return { clicks, impressions, ctr: impressions ? clicks / impressions : 0, position: 7.4 };
}

const QUERIES: Array<[string, number]> = [
  ['kamus sambas', 4.2],
  ['bahasa sambas', 6.8],
  ['wisata sambas', 9.1],
  ['arti bagak bahasa sambas', 3.1],
  ['terjemahan bahasa sambas', 5.5],
];

export class FakeSearchAnalyticsProvider implements SearchAnalyticsProvider {
  isConfigured(): boolean {
    return true;
  }

  async getOverview(range: ResolvedRange): Promise<SearchOverview> {
    const totals = searchTotals(range.current);
    return {
      totals,
      previous: searchTotals(range.previous),
      trend: searchTrend(range.current),
      topQueries: QUERIES.map(([query, position], i) => {
        const impressions = Math.round(totals.impressions / (i + 2.5));
        const clicks = Math.round(impressions * (0.06 - i * 0.008));
        return { query, clicks, impressions, ctr: clicks / impressions, position };
      }),
    };
  }

  async getSearch(range: ResolvedRange): Promise<SearchDetail> {
    const overview = await this.getOverview(range);
    return {
      ...overview,
      topPages: ['https://sambasku.com/', 'https://sambasku.com/kata/bagak', 'https://sambasku.com/wisata'].map(
        (page, i) => {
          const impressions = Math.round(overview.totals.impressions / (i + 2));
          const clicks = Math.round(impressions * 0.05);
          return { page, clicks, impressions, ctr: clicks / impressions, position: 5 + i * 2.3 };
        },
      ),
    };
  }
}
