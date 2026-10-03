import { ValidationError } from '@/shared/errors/app-error';
import { logger } from '@/shared/logging/logger';
import {
  addDays,
  InvalidDateRangeError,
  resolveDateRange,
  shiftRangeToLatest,
  todayWib,
  type RangePreset,
} from '../../domain/date-range';
import type {
  ProviderResult,
  ResolvedRange,
  SearchFilters,
  WebAnalyticsReport,
  WebAnalyticsSection,
} from '../../domain/entities/web-analytics.entity';
import {
  AnalyticsProviderError,
  type AnalyticsProviderErrorKind,
  type SearchAnalyticsProvider,
  type VisitorAnalyticsProvider,
} from '../ports/analytics-provider.port';

/** Data Search Console baru lengkap ~2-3 hari kemudian. */
export const SEARCH_CONSOLE_LAG_DAYS = 3;

export interface GetWebAnalyticsInput {
  section: WebAnalyticsSection;
  range: RangePreset;
  start?: string;
  end?: string;
  filters?: SearchFilters;
}

type ProviderKey = 'ga4' | 'searchConsole';

const PROVIDER_COPY: Record<ProviderKey, { prefix: string; name: string; permissionHint: string }> = {
  ga4: {
    prefix: 'GA4',
    name: 'Google Analytics',
    permissionHint: 'Cek service account sudah jadi Viewer di property GA4.',
  },
  searchConsole: {
    prefix: 'SEARCH_CONSOLE',
    name: 'Search Console',
    permissionHint: 'Cek service account sudah ditambahkan sebagai user di Search Console.',
  },
};

const ERROR_SUFFIX: Record<AnalyticsProviderErrorKind, string> = {
  permission_denied: 'PERMISSION_DENIED',
  rate_limited: 'RATE_LIMITED',
  upstream: 'UPSTREAM_ERROR',
  network: 'NETWORK_ERROR',
};

function errorMessage(key: ProviderKey, kind: AnalyticsProviderErrorKind): string {
  const { name, permissionHint } = PROVIDER_COPY[key];
  switch (kind) {
    case 'permission_denied':
      return `Akses ke ${name} ditolak. ${permissionHint}`;
    case 'rate_limited':
      return `Kuota ${name} lagi penuh. Coba lagi beberapa menit lagi.`;
    case 'upstream':
      return `${name} lagi bermasalah. Coba lagi nanti.`;
    case 'network':
      return `Server gagal menghubungi ${name}. Coba lagi sebentar lagi.`;
  }
}

interface CacheEntry {
  expiresAt: number;
  result: ProviderResult;
}

/**
 * Orkestrasi provider trafik web per section. Provider jalan paralel dan
 * gagal sendiri-sendiri: satu error tidak menjatuhkan provider lain dan
 * tidak pernah jadi 5xx endpoint. Hasil ok/empty di-cache; error tidak.
 */
export class GetWebAnalyticsUseCase {
  // ponytail: in-memory TTL cache, single-isolate - upgrade KV kalau multi-instance & kuota Google mepet
  private readonly cache = new Map<string, CacheEntry>();

  constructor(
    private readonly deps: {
      visitor: VisitorAnalyticsProvider;
      search: SearchAnalyticsProvider;
      ga4CacheTtlSeconds: number;
      searchConsoleCacheTtlSeconds: number;
      now?: () => Date;
    },
  ) {}

  async execute(input: GetWebAnalyticsInput): Promise<WebAnalyticsReport> {
    const now = this.deps.now?.() ?? new Date();
    let range: ResolvedRange;
    try {
      range = resolveDateRange(input, now);
    } catch (err) {
      if (err instanceof InvalidDateRangeError) {
        throw new ValidationError([{ field: err.field, message: err.message }]);
      }
      throw err;
    }
    const searchRange = shiftRangeToLatest(range, addDays(todayWib(now), -SEARCH_CONSOLE_LAG_DAYS));
    const { visitor, search } = this.deps;
    const filterKey = input.filters ? `${input.filters.page ?? ''}|${input.filters.query ?? ''}` : '';

    const report: WebAnalyticsReport = {
      section: input.section,
      range: {
        start: range.current.start,
        end: range.current.end,
        previousStart: range.previous.start,
        previousEnd: range.previous.end,
        days: range.days,
      },
    };

    const ga4 = (load: () => Promise<{ totals?: { sessions: number; pageViews: number }; totalSessions?: number }>) =>
      this.run('ga4', input.section, range, visitor, load, isGa4Empty);
    const gsc = (load: () => Promise<{ totals: { impressions: number } }>) =>
      this.run('searchConsole', `${input.section}:${filterKey}`, searchRange, search, load, isSearchEmpty);

    switch (input.section) {
      case 'overview': {
        const [g, s] = await Promise.all([
          ga4(() => visitor.getOverview(range)),
          gsc(() => search.getOverview(searchRange)),
        ]);
        report.ga4 = g;
        report.searchConsole = s;
        break;
      }
      case 'visitors':
        report.ga4 = await ga4(() => visitor.getVisitors(range));
        break;
      case 'behavior':
        report.ga4 = await ga4(() => visitor.getBehavior(range));
        break;
      case 'sources':
        report.ga4 = await ga4(() => visitor.getSources(range));
        break;
      case 'search':
        report.searchConsole = await gsc(() => search.getSearch(searchRange, input.filters));
        break;
    }
    return report;
  }

  private async run<T>(
    key: ProviderKey,
    cacheScope: string,
    range: ResolvedRange,
    provider: { isConfigured(): boolean },
    load: () => Promise<T>,
    isEmpty: (data: T) => boolean,
  ): Promise<ProviderResult> {
    const { prefix } = PROVIDER_COPY[key];
    if (!provider.isConfigured()) {
      return { status: 'not_configured', errorCode: `${prefix}_NOT_CONFIGURED`, message: null, range: null, data: null };
    }
    const cacheKey = `${key}:${cacheScope}:${range.current.start}:${range.current.end}`;
    const cached = this.cache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) return cached.result;

    let result: ProviderResult;
    try {
      const data = await load();
      result = isEmpty(data)
        ? { status: 'empty', errorCode: null, message: null, range: range.current, data: null }
        : { status: 'ok', errorCode: null, message: null, range: range.current, data };
    } catch (err) {
      const kind: AnalyticsProviderErrorKind = err instanceof AnalyticsProviderError ? err.kind : 'upstream';
      logger.warn({ provider: key, kind, err: (err as Error).message }, 'web analytics provider gagal');
      return {
        status: 'error',
        errorCode: `${prefix}_${ERROR_SUFFIX[kind]}`,
        message: errorMessage(key, kind),
        range: range.current,
        data: null,
      };
    }

    const ttl = key === 'ga4' ? this.deps.ga4CacheTtlSeconds : this.deps.searchConsoleCacheTtlSeconds;
    if (ttl > 0) this.cache.set(cacheKey, { result, expiresAt: Date.now() + ttl * 1000 });
    return result;
  }
}

function isGa4Empty(data: { totals?: { sessions: number; pageViews: number }; totalSessions?: number }): boolean {
  if (data.totals) return data.totals.sessions === 0 && data.totals.pageViews === 0;
  return (data.totalSessions ?? 0) === 0;
}

function isSearchEmpty(data: { totals: { impressions: number } }): boolean {
  return data.totals.impressions === 0;
}
