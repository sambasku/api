import type { GoogleServiceAccount } from '@/shared/google/service-account-token';
import type { SearchAnalyticsProvider } from '../application/ports/analytics-provider.port';
import type {
  DateRange,
  QueryRow,
  ResolvedRange,
  SearchDetail,
  SearchFilters,
  SearchOverview,
  SearchPageRow,
  SearchTotals,
  SearchTrendPoint,
} from '../domain/entities/web-analytics.entity';
import { postGoogleJson } from './google-http';

const GSC_SCOPE = 'https://www.googleapis.com/auth/webmasters.readonly';

interface GscRow {
  keys?: string[];
  clicks?: number;
  impressions?: number;
  ctr?: number;
  position?: number;
}

interface GscRequest {
  startDate: string;
  endDate: string;
  dimensions?: Array<'date' | 'query' | 'page'>;
  rowLimit?: number;
  dimensionFilterGroups?: Array<{
    filters: Array<{ dimension: 'page' | 'query'; operator: 'contains'; expression: string }>;
  }>;
}

const metricsOf = (row: GscRow | undefined) => ({
  clicks: row?.clicks ?? 0,
  impressions: row?.impressions ?? 0,
  ctr: row?.ctr ?? 0,
  position: row?.position ?? 0,
});

export function parseSearchTotals(rows: GscRow[] | undefined): SearchTotals {
  return metricsOf(rows?.[0]);
}

export function parseSearchTrend(rows: GscRow[] | undefined): SearchTrendPoint[] {
  return (rows ?? [])
    .map((r) => ({ date: r.keys?.[0] ?? '', clicks: r.clicks ?? 0, impressions: r.impressions ?? 0 }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

function parseQueries(rows: GscRow[] | undefined): QueryRow[] {
  return (rows ?? []).map((r) => ({ query: r.keys?.[0] ?? '', ...metricsOf(r) }));
}

function parsePages(rows: GscRow[] | undefined): SearchPageRow[] {
  return (rows ?? []).map((r) => ({ page: r.keys?.[0] ?? '', ...metricsOf(r) }));
}

export function buildFilterGroups(filters: SearchFilters | undefined): GscRequest['dimensionFilterGroups'] {
  const list = (['page', 'query'] as const)
    .filter((d) => filters?.[d]?.trim())
    .map((dimension) => ({ dimension, operator: 'contains' as const, expression: filters![dimension]!.trim() }));
  return list.length ? [{ filters: list }] : undefined;
}

export interface SearchConsoleConfig {
  account: GoogleServiceAccount | null;
  /** `sc-domain:sambasku.com` atau `https://sambasku.com/`. */
  siteUrl: string | null;
}

/** Search Console API searchAnalytics.query - beberapa query kecil paralel per section. */
export class SearchConsoleProvider implements SearchAnalyticsProvider {
  constructor(private readonly config: SearchConsoleConfig) {}

  isConfigured(): boolean {
    return Boolean(this.config.account && this.config.siteUrl);
  }

  async getOverview(range: ResolvedRange): Promise<SearchOverview> {
    const [totals, previous, trend, queries] = await Promise.all([
      this.query(range.current, {}),
      this.query(range.previous, {}),
      this.query(range.current, { dimensions: ['date'], rowLimit: 500 }),
      this.query(range.current, { dimensions: ['query'], rowLimit: 10 }),
    ]);
    return {
      totals: parseSearchTotals(totals),
      previous: parseSearchTotals(previous),
      trend: parseSearchTrend(trend),
      topQueries: parseQueries(queries),
    };
  }

  async getSearch(range: ResolvedRange, filters?: SearchFilters): Promise<SearchDetail> {
    const dimensionFilterGroups = buildFilterGroups(filters);
    const base = dimensionFilterGroups ? { dimensionFilterGroups } : {};
    const [totals, previous, trend, queries, pages] = await Promise.all([
      this.query(range.current, base),
      this.query(range.previous, base),
      this.query(range.current, { ...base, dimensions: ['date'], rowLimit: 500 }),
      this.query(range.current, { ...base, dimensions: ['query'], rowLimit: 20 }),
      this.query(range.current, { ...base, dimensions: ['page'], rowLimit: 20 }),
    ]);
    return {
      totals: parseSearchTotals(totals),
      previous: parseSearchTotals(previous),
      trend: parseSearchTrend(trend),
      topQueries: parseQueries(queries),
      topPages: parsePages(pages),
    };
  }

  private async query(range: DateRange, body: Omit<GscRequest, 'startDate' | 'endDate'>): Promise<GscRow[] | undefined> {
    const { account, siteUrl } = this.config;
    if (!account || !siteUrl) throw new Error('SearchConsoleProvider dipanggil tanpa konfigurasi');
    const res = await postGoogleJson<{ rows?: GscRow[] }>(
      account,
      GSC_SCOPE,
      `https://searchconsole.googleapis.com/webmasters/v3/sites/${encodeURIComponent(siteUrl)}/searchAnalytics/query`,
      { startDate: range.start, endDate: range.end, ...body },
    );
    return res.rows;
  }
}
