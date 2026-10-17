import { ValidationError } from '@/shared/errors/app-error';
import { logger } from '@/shared/logging/logger';
import {
  InvalidDateRangeError,
  resolveDateRange,
  type RangePreset,
} from '@/modules/web-analytics/domain/date-range';
import type { ResolvedRange } from '@/modules/web-analytics/domain/entities/web-analytics.entity';
import type {
  MobileAnalyticsReport,
  MobileAnalyticsSection,
  MobileProviderResult,
} from '../../domain/entities/mobile-analytics.entity';
import {
  MobileAnalyticsProviderError,
  type MobileAnalyticsProviderErrorKind,
  type MobileAnalyticsProvider,
} from '../ports/mobile-analytics.port';

const MOBILE_PREFIX = 'MOBILE';
const ERROR_SUFFIX: Record<MobileAnalyticsProviderErrorKind, string> = {
  permission_denied: 'PERMISSION_DENIED',
  rate_limited: 'RATE_LIMITED',
  upstream: 'UPSTREAM_ERROR',
  network: 'NETWORK_ERROR',
};

function errorMessage(kind: MobileAnalyticsProviderErrorKind): string {
  switch (kind) {
    case 'permission_denied':
      return 'Akses ke Google Analytics mobile ditolak. Cek service account sudah jadi Viewer di property GA4 mobile.';
    case 'rate_limited':
      return 'Kuota Google lagi penuh. Coba lagi beberapa menit lagi.';
    case 'upstream':
      return 'Google Analytics mobile lagi bermasalah. Coba lagi nanti.';
    case 'network':
      return 'Server gagal menghubungi Google. Coba lagi sebentar lagi.';
  }
}

interface CacheEntry {
  expiresAt: number;
  result: MobileProviderResult;
}

function isEmpty(data: { totals: { event_count: number; sessions: number } }): boolean {
  return data.totals.event_count === 0 && data.totals.sessions === 0;
}

export interface GetMobileAnalyticsInput {
  section: MobileAnalyticsSection;
  range: RangePreset;
  start?: string;
  end?: string;
}

/**
 * Orkestrasi provider analitik GA4 mobile per section. Error Google
 * dinormalisasi ke status error di dalam 200 (pola sama dengan web-analytics
 * dan fcm-analytics); hasil ok/empty di-cache in-memory.
 */
export class GetMobileAnalyticsUseCase {
  // ponytail: in-memory TTL cache, single-isolate - upgrade KV kalau multi-instance & kuota Google mepet
  private readonly cache = new Map<string, CacheEntry>();

  constructor(
    private readonly deps: {
      mobile: MobileAnalyticsProvider;
      cacheTtlSeconds: number;
      now?: () => Date;
    },
  ) {}

  async execute(input: GetMobileAnalyticsInput): Promise<MobileAnalyticsReport> {
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

    const report: MobileAnalyticsReport = {
      section: input.section,
      range: {
        start: range.current.start,
        end: range.current.end,
        previousStart: range.previous.start,
        previousEnd: range.previous.end,
        days: range.days,
      },
      mobile: await this.run(input.section, range),
    };
    return report;
  }

  private async run(section: MobileAnalyticsSection, range: ResolvedRange): Promise<MobileProviderResult> {
    const { mobile, cacheTtlSeconds } = this.deps;
    if (!mobile.isConfigured()) {
      return { status: 'not_configured', errorCode: `${MOBILE_PREFIX}_NOT_CONFIGURED`, message: null, range: null, data: null };
    }
    const cacheKey = `mobile:${section}:${range.current.start}:${range.current.end}`;
    const cached = this.cache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) return cached.result;

    let result: MobileProviderResult;
    try {
      const data =
        section === 'overview'
          ? await mobile.getOverview(range)
          : section === 'events'
            ? await mobile.getEvents(range)
            : section === 'screens'
              ? await mobile.getScreens(range)
              : await mobile.getAudience(range);
      result = isEmpty(data)
        ? { status: 'empty', errorCode: null, message: null, range: range.current, data: null }
        : { status: 'ok', errorCode: null, message: null, range: range.current, data };
    } catch (err) {
      const kind: MobileAnalyticsProviderErrorKind = err instanceof MobileAnalyticsProviderError ? err.kind : 'upstream';
      logger.warn({ provider: 'mobile', kind, section, err: (err as Error).message }, 'mobile analytics provider gagal');
      return {
        status: 'error',
        errorCode: `${MOBILE_PREFIX}_${ERROR_SUFFIX[kind]}`,
        message: errorMessage(kind),
        range: range.current,
        data: null,
      };
    }
    if (cacheTtlSeconds > 0) this.cache.set(cacheKey, { result, expiresAt: Date.now() + cacheTtlSeconds * 1000 });
    return result;
  }
}
