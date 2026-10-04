import type { GoogleServiceAccount } from '@/shared/google/service-account-token';
import type { VisitorAnalyticsProvider } from '../application/ports/analytics-provider.port';
import type {
  BreakdownRow,
  ChannelRow,
  DateRange,
  Ga4Behavior,
  Ga4Overview,
  Ga4Sources,
  Ga4Totals,
  Ga4TrendPoint,
  Ga4Visitors,
  PageRow,
  ResolvedRange,
  TrafficChannel,
} from '../domain/entities/web-analytics.entity';
import { postGoogleJson } from './google-http';

const GA4_SCOPE = 'https://www.googleapis.com/auth/analytics.readonly';
const TOP_LIMIT = 20;

const TOTAL_METRICS = [
  'activeUsers',
  'totalUsers',
  'newUsers',
  'sessions',
  'screenPageViews',
  'eventCount',
  'engagementRate',
] as const;

interface Ga4ReportRequest {
  dateRanges: Array<{ startDate: string; endDate: string; name?: string }>;
  dimensions?: Array<{ name: string }>;
  metrics: Array<{ name: string }>;
  orderBys?: Array<{ dimension?: { dimensionName: string }; metric?: { metricName: string }; desc?: boolean }>;
  limit?: number;
}

interface Ga4ReportResponse {
  dimensionHeaders?: Array<{ name: string }>;
  metricHeaders?: Array<{ name: string }>;
  rows?: Array<{ dimensionValues?: Array<{ value?: string }>; metricValues?: Array<{ value?: string }> }>;
}

type Ga4Record = Record<string, string | number>;

/** Baris GA4 -> record ber-key nama header (dimensi string, metrik number). */
export function toRecords(report: Ga4ReportResponse | undefined): Ga4Record[] {
  if (!report?.rows) return [];
  const dims = (report.dimensionHeaders ?? []).map((h) => h.name);
  const mets = (report.metricHeaders ?? []).map((h) => h.name);
  return report.rows.map((row) => {
    const rec: Ga4Record = {};
    dims.forEach((name, i) => (rec[name] = row.dimensionValues?.[i]?.value ?? ''));
    mets.forEach((name, i) => (rec[name] = Number(row.metricValues?.[i]?.value ?? 0) || 0));
    return rec;
  });
}

const num = (rec: Ga4Record | undefined, key: string): number => Number(rec?.[key] ?? 0) || 0;
const str = (rec: Ga4Record, key: string): string => String(rec[key] ?? '');

function totalsFrom(rec: Ga4Record | undefined): Ga4Totals {
  return {
    activeUsers: num(rec, 'activeUsers'),
    totalUsers: num(rec, 'totalUsers'),
    newUsers: num(rec, 'newUsers'),
    sessions: num(rec, 'sessions'),
    pageViews: num(rec, 'screenPageViews'),
    eventCount: num(rec, 'eventCount'),
    engagementRate: num(rec, 'engagementRate'),
  };
}

/** Report dengan 2 dateRanges: GA4 menambah dimensi `dateRange` berisi nama range. */
export function parseTotals(report: Ga4ReportResponse | undefined): { totals: Ga4Totals; previous: Ga4Totals } {
  const recs = toRecords(report);
  return {
    totals: totalsFrom(recs.find((r) => r.dateRange === 'current')),
    previous: totalsFrom(recs.find((r) => r.dateRange === 'previous')),
  };
}

function ga4DateToYmd(v: string): string {
  return /^\d{8}$/.test(v) ? `${v.slice(0, 4)}-${v.slice(4, 6)}-${v.slice(6, 8)}` : v;
}

function parseTrend(report: Ga4ReportResponse | undefined): Ga4TrendPoint[] {
  return toRecords(report)
    .map((r) => ({
      date: ga4DateToYmd(str(r, 'date')),
      activeUsers: num(r, 'activeUsers'),
      sessions: num(r, 'sessions'),
      pageViews: num(r, 'screenPageViews'),
    }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

function parsePages(report: Ga4ReportResponse | undefined): PageRow[] {
  return toRecords(report).map((r) => ({
    path: str(r, 'pagePath'),
    views: num(r, 'screenPageViews'),
    users: num(r, 'totalUsers'),
  }));
}

function parseBreakdown(report: Ga4ReportResponse | undefined, dimension: string): BreakdownRow[] {
  return toRecords(report).map((r) => ({
    key: str(r, dimension),
    users: num(r, 'totalUsers'),
    sessions: num(r, 'sessions'),
  }));
}

const CHANNEL_ORDER: TrafficChannel[] = ['organic_search', 'direct', 'social', 'referral', 'other'];

/** Default channel group GA4 -> 5 kelompok yang dipahami admin. */
export function channelBucket(group: string): TrafficChannel {
  if (group === 'Organic Search') return 'organic_search';
  if (group === 'Direct') return 'direct';
  if (/social/i.test(group)) return 'social';
  if (group === 'Referral') return 'referral';
  return 'other';
}

export function parseChannels(report: Ga4ReportResponse | undefined): Ga4Sources {
  const sums = new Map<TrafficChannel, number>(CHANNEL_ORDER.map((c) => [c, 0]));
  for (const r of toRecords(report)) {
    const bucket = channelBucket(str(r, 'sessionDefaultChannelGroup'));
    sums.set(bucket, (sums.get(bucket) ?? 0) + num(r, 'sessions'));
  }
  const totalSessions = [...sums.values()].reduce((a, b) => a + b, 0);
  const channels: ChannelRow[] = CHANNEL_ORDER.map((channel) => {
    const sessions = sums.get(channel) ?? 0;
    return { channel, sessions, share: totalSessions > 0 ? sessions / totalSessions : 0 };
  });
  return { totalSessions, channels };
}

const dr = (r: DateRange, name?: string) => ({ startDate: r.start, endDate: r.end, ...(name ? { name } : {}) });
const metrics = (...names: string[]) => names.map((name) => ({ name }));
const byMetricDesc = (metricName: string) => [{ metric: { metricName }, desc: true }];

function totalsRequest(range: ResolvedRange): Ga4ReportRequest {
  return {
    dateRanges: [dr(range.current, 'current'), dr(range.previous, 'previous')],
    metrics: metrics(...TOTAL_METRICS),
  };
}

function trendRequest(range: ResolvedRange): Ga4ReportRequest {
  return {
    dateRanges: [dr(range.current)],
    dimensions: [{ name: 'date' }],
    metrics: metrics('activeUsers', 'sessions', 'screenPageViews'),
    orderBys: [{ dimension: { dimensionName: 'date' } }],
    limit: 400,
  };
}

function topRequest(range: ResolvedRange, dimension: string, metricNames: string[], limit = TOP_LIMIT): Ga4ReportRequest {
  return {
    dateRanges: [dr(range.current)],
    dimensions: [{ name: dimension }],
    metrics: metrics(...metricNames),
    orderBys: byMetricDesc(metricNames[0]!),
    limit,
  };
}

export interface Ga4Config {
  account: GoogleServiceAccount | null;
  propertyId: string | null;
}

/** Google Analytics Data API v1beta - satu batchRunReports (maks 5 report) per section. */
export class Ga4Provider implements VisitorAnalyticsProvider {
  constructor(private readonly config: Ga4Config) {}

  isConfigured(): boolean {
    return Boolean(this.config.account && this.config.propertyId);
  }

  async getOverview(range: ResolvedRange): Promise<Ga4Overview> {
    const [totals, trend, pages] = await this.batch([
      totalsRequest(range),
      trendRequest(range),
      topRequest(range, 'pagePath', ['screenPageViews', 'totalUsers'], 10),
    ]);
    return { ...parseTotals(totals), trend: parseTrend(trend), topPages: parsePages(pages) };
  }

  async getVisitors(range: ResolvedRange): Promise<Ga4Visitors> {
    const [totals, trend, devices, countries] = await this.batch([
      totalsRequest(range),
      trendRequest(range),
      topRequest(range, 'deviceCategory', ['totalUsers', 'sessions'], 10),
      topRequest(range, 'country', ['totalUsers', 'sessions'], 10),
    ]);
    return {
      ...parseTotals(totals),
      trend: parseTrend(trend),
      devices: parseBreakdown(devices, 'deviceCategory'),
      countries: parseBreakdown(countries, 'country'),
    };
  }

  async getBehavior(range: ResolvedRange): Promise<Ga4Behavior> {
    const [totals, pages, landing, events] = await this.batch([
      totalsRequest(range),
      topRequest(range, 'pagePath', ['screenPageViews', 'totalUsers']),
      topRequest(range, 'landingPage', ['sessions', 'engagementRate']),
      topRequest(range, 'eventName', ['eventCount', 'totalUsers']),
    ]);
    return {
      ...parseTotals(totals),
      topPages: parsePages(pages),
      landingPages: toRecords(landing).map((r) => ({
        path: str(r, 'landingPage'),
        sessions: num(r, 'sessions'),
        engagementRate: num(r, 'engagementRate'),
      })),
      events: toRecords(events).map((r) => ({
        name: str(r, 'eventName'),
        count: num(r, 'eventCount'),
        users: num(r, 'totalUsers'),
      })),
    };
  }

  async getSources(range: ResolvedRange): Promise<Ga4Sources> {
    const [channels] = await this.batch([topRequest(range, 'sessionDefaultChannelGroup', ['sessions'], 50)]);
    return parseChannels(channels);
  }

  private async batch(requests: Ga4ReportRequest[]): Promise<Array<Ga4ReportResponse | undefined>> {
    const { account, propertyId } = this.config;
    if (!account || !propertyId) throw new Error('Ga4Provider dipanggil tanpa konfigurasi');
    const res = await postGoogleJson<{ reports?: Ga4ReportResponse[] }>(
      account,
      GA4_SCOPE,
      `https://analyticsdata.googleapis.com/v1beta/properties/${encodeURIComponent(propertyId)}:batchRunReports`,
      { requests },
    );
    return requests.map((_, i) => res.reports?.[i]);
  }
}
