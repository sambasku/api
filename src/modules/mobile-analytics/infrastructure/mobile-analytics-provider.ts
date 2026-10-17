import type { GoogleServiceAccount } from '@/shared/google/service-account-token';
import type { MobileAnalyticsProvider } from '../application/ports/mobile-analytics.port';
import type { ResolvedRange } from '@/modules/web-analytics/domain/entities/web-analytics.entity';
import type {
  MobileOverview,
  MobileEvents,
  MobileScreens,
  MobileAudience,
  MobileTotals,
  MobileTrendPoint,
  ScreenRow,
  EventRow,
  PlatformRow,
  AppVersionRow,
  CountryRow,
} from '../domain/entities/mobile-analytics.entity';
import { postGoogleJson } from './google-http';

const MOBILE_GA4_SCOPE = 'https://www.googleapis.com/auth/analytics.readonly';
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

type MobileRecord = Record<string, string | number>;

function toRecords(report: Ga4ReportResponse | undefined): MobileRecord[] {
  if (!report?.rows) return [];
  const dims = (report.dimensionHeaders ?? []).map((h) => h.name);
  const mets = (report.metricHeaders ?? []).map((h) => h.name);
  return report.rows.map((row) => {
    const rec: MobileRecord = {};
    dims.forEach((name, i) => (rec[name] = row.dimensionValues?.[i]?.value ?? ''));
    mets.forEach((name, i) => (rec[name] = Number(row.metricValues?.[i]?.value ?? 0) || 0));
    return rec;
  });
}

const num = (rec: MobileRecord | undefined, key: string): number => Number(rec?.[key] ?? 0) || 0;
const str = (rec: MobileRecord, key: string): string => String(rec[key] ?? '');

function totalsFrom(rec: MobileRecord | undefined): MobileTotals {
  return {
    active_users: num(rec, 'activeUsers'),
    total_users: num(rec, 'totalUsers'),
    new_users: num(rec, 'newUsers'),
    sessions: num(rec, 'sessions'),
    event_count: num(rec, 'eventCount'),
    engagement_rate: num(rec, 'engagementRate'),
  };
}

function ga4DateToYmd(v: string): string {
  return /^\d{8}$/.test(v) ? `${v.slice(0, 4)}-${v.slice(4, 6)}-${v.slice(6, 8)}` : v;
}

function parseTrend(report: Ga4ReportResponse | undefined): MobileTrendPoint[] {
  return toRecords(report)
    .map((r) => ({
      date: ga4DateToYmd(str(r, 'date')),
      active_users: num(r, 'activeUsers'),
      sessions: num(r, 'sessions'),
      event_count: num(r, 'eventCount'),
    }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

function parseScreens(report: Ga4ReportResponse | undefined): ScreenRow[] {
  return toRecords(report).map((r) => ({
    name: str(r, 'unifiedScreenName'),
    views: num(r, 'screenPageViews'),
    users: num(r, 'activeUsers'),
  }));
}

function parseEvents(report: Ga4ReportResponse | undefined): EventRow[] {
  return toRecords(report).map((r) => ({
    name: str(r, 'eventName'),
    count: num(r, 'eventCount'),
    users: num(r, 'activeUsers'),
  }));
}

function parsePlatforms(report: Ga4ReportResponse | undefined): PlatformRow[] {
  return toRecords(report).map((r) => ({
    platform: str(r, 'platform').toLowerCase() === 'ios' ? 'ios' : 'android',
    users: num(r, 'activeUsers'),
    sessions: num(r, 'sessions'),
    share: 0,
  }));
}

function parseAppVersions(report: Ga4ReportResponse | undefined): AppVersionRow[] {
  return toRecords(report).map((r) => ({
    version: str(r, 'appVersion'),
    users: num(r, 'activeUsers'),
    sessions: num(r, 'sessions'),
    share: 0,
  }));
}

function parseCountries(report: Ga4ReportResponse | undefined): CountryRow[] {
  return toRecords(report).map((r) => ({
    country: str(r, 'country'),
    users: num(r, 'activeUsers'),
    sessions: num(r, 'sessions'),
    share: 0,
  }));
}

export interface MobileAnalyticsConfig {
  account: GoogleServiceAccount | null;
  propertyId: string | null;
}

export class MobileAnalyticsProviderImpl implements MobileAnalyticsProvider {
  constructor(private readonly config: MobileAnalyticsConfig) {}

  isConfigured(): boolean {
    return Boolean(this.config.account && this.config.propertyId);
  }

  async getOverview(range: ResolvedRange): Promise<MobileOverview> {
    const [totals, trend, events, screens] = await this.batch([
      this.totalsRequest(range),
      this.trendRequest(range),
      this.topRequest(range, 'eventName', ['eventCount', 'activeUsers'], TOP_LIMIT),
      this.topRequest(range, 'unifiedScreenName', ['screenPageViews', 'activeUsers'], TOP_LIMIT),
    ]);
    return {
      ...this.parseTotals(totals),
      trend: parseTrend(trend),
      top_events: parseEvents(events),
      top_screens: parseScreens(screens),
    };
  }

  async getEvents(range: ResolvedRange): Promise<MobileEvents> {
    const [totals, trend, events] = await this.batch([
      this.totalsRequest(range),
      this.trendRequest(range),
      this.topRequest(range, 'eventName', ['eventCount', 'activeUsers'], 100),
    ]);
    return {
      ...this.parseTotals(totals),
      trend: parseTrend(trend),
      events: parseEvents(events),
    };
  }

  async getScreens(range: ResolvedRange): Promise<MobileScreens> {
    const [totals, trend, screens] = await this.batch([
      this.totalsRequest(range),
      this.trendRequest(range),
      this.topRequest(range, 'unifiedScreenName', ['screenPageViews', 'activeUsers'], 50),
    ]);
    return {
      ...this.parseTotals(totals),
      trend: parseTrend(trend),
      screens: parseScreens(screens),
    };
  }

  async getAudience(range: ResolvedRange): Promise<MobileAudience> {
    const [totals, trend, platforms, versions, countries] = await this.batch([
      this.totalsRequest(range),
      this.trendRequest(range),
      this.topRequest(range, 'platform', ['activeUsers', 'sessions'], TOP_LIMIT),
      this.topRequest(range, 'appVersion', ['activeUsers', 'sessions'], TOP_LIMIT),
      this.topRequest(range, 'country', ['activeUsers', 'sessions'], TOP_LIMIT),
    ]);
    const { totals: tot, previous: prev } = this.parseTotals(totals);
    const platformShare = this.calculateShare(parsePlatforms(platforms));
    const versionShare = this.calculateShare(parseAppVersions(versions));
    const countryShare = this.calculateShare(parseCountries(countries));
    return {
      totals: tot,
      previous: prev,
      trend: parseTrend(trend),
      platforms: platformShare,
      app_versions: versionShare,
      countries: countryShare,
    };
  }

  private parseTotals(report: Ga4ReportResponse | undefined): { totals: MobileTotals; previous: MobileTotals } {
    const recs = toRecords(report);
    return {
      totals: totalsFrom(recs.find((r) => r.dateRange === 'current')),
      previous: totalsFrom(recs.find((r) => r.dateRange === 'previous')),
    };
  }

  private async batch(requests: Ga4ReportRequest[]): Promise<Array<Ga4ReportResponse | undefined>> {
    const { account, propertyId } = this.config;
    if (!account || !propertyId) throw new Error('MobileAnalyticsProviderImpl dipanggil tanpa konfigurasi');
    const res = await postGoogleJson<{ reports?: Ga4ReportResponse[] }>(
      account,
      MOBILE_GA4_SCOPE,
      `https://analyticsdata.googleapis.com/v1beta/properties/${encodeURIComponent(propertyId)}:batchRunReports`,
      { requests },
    );
    return requests.map((_, i) => res.reports?.[i]);
  }

  private totalsRequest(range: ResolvedRange): Ga4ReportRequest {
    return {
      dateRanges: [
        { startDate: range.current.start, endDate: range.current.end, name: 'current' },
        { startDate: range.previous.start, endDate: range.previous.end, name: 'previous' },
      ],
      metrics: TOTAL_METRICS.map((name) => ({ name })),
    };
  }

  private trendRequest(range: ResolvedRange): Ga4ReportRequest {
    return {
      dateRanges: [{ startDate: range.current.start, endDate: range.current.end }],
      dimensions: [{ name: 'date' }],
      metrics: [{ name: 'activeUsers' }, { name: 'sessions' }, { name: 'eventCount' }],
      orderBys: [{ dimension: { dimensionName: 'date' } }],
      limit: 400,
    };
  }

  private topRequest(range: ResolvedRange, dimension: string, metricNames: string[], limit = TOP_LIMIT): Ga4ReportRequest {
    return {
      dateRanges: [{ startDate: range.current.start, endDate: range.current.end }],
      dimensions: [{ name: dimension }],
      metrics: metricNames.map((name) => ({ name })),
      orderBys: [{ metric: { metricName: metricNames[0]! }, desc: true }],
      limit,
    };
  }

  private calculateShare<T extends { sessions: number }>(items: T[]): T[] {
    const total = items.reduce((sum, item) => sum + item.sessions, 0);
    return items.map((item) => ({ ...item, share: total > 0 ? item.sessions / total : 0 }));
  }
}
