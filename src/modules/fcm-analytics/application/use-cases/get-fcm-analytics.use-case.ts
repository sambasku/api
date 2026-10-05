import { ValidationError } from '@/shared/errors/app-error';
import { logger } from '@/shared/logging/logger';
import {
  InvalidDateRangeError,
  resolveDateRange,
  type RangePreset,
} from '@/modules/web-analytics/domain/date-range';
import type {
  FcmAnalyticsReport,
  FcmAnalyticsSection,
  FcmProviderResult,
} from '../../domain/entities/fcm-analytics.entity';
import { AnalyticsProviderError, type AnalyticsProviderErrorKind, type FcmAnalyticsProvider } from '../ports/fcm-analytics.port';
import type { ResolvedRange } from '@/modules/web-analytics/domain/entities/web-analytics.entity';

/** FCM Data API cuma simpan ~14 hari; rentang lebih panjang pasti ada 0. */
export const FCM_DATA_LAG_DAYS = 1;

export interface GetFcmAnalyticsInput {
  section: FcmAnalyticsSection;
  range: RangePreset;
  start?: string;
  end?: string;
}

const FCM_PREFIX = 'FCM';

const ERROR_SUFFIX: Record<AnalyticsProviderErrorKind, string> = {
  permission_denied: 'PERMISSION_DENIED',
  rate_limited: 'RATE_LIMITED',
  upstream: 'UPSTREAM_ERROR',
  network: 'NETWORK_ERROR',
};

function errorMessage(kind: AnalyticsProviderErrorKind): string {
  switch (kind) {
    case 'permission_denied':
      return 'Akses ke Firebase ditolak. Cek service account FCM punya role Cloud Messaging atau Firebase Viewer.';
    case 'rate_limited':
      return 'Kuota Google lagi penuh. Coba lagi beberapa menit lagi.';
    case 'upstream':
      return 'Firebase lagi bermasalah. Coba lagi nanti.';
    case 'network':
      return 'Server gagal menghubungi Google. Coba lagi sebentar lagi.';
  }
}

interface CacheEntry {
  expiresAt: number;
  result: FcmProviderResult;
}

function isEmpty(data: { totals: { sent: number; opened: number } }): boolean {
  return data.totals.sent === 0 && data.totals.opened === 0;
}

/**
 * Orkestrasi section analitik notifikasi. Error tidak pernah jadi 5xx
 * endpoint: status provider dikembalikan di dalam 200, pola sama dengan
 * web-analytics dan play-analytics.
 */
export class GetFcmAnalyticsUseCase {
  // ponytail: in-memory TTL cache, single-isolate - upgrade KV kalau multi-instance
  private readonly cache = new Map<string, CacheEntry>();

  constructor(
    private readonly deps: {
      fcm: FcmAnalyticsProvider;
      cacheTtlSeconds: number;
      now?: () => Date;
    },
  ) {}

  async execute(input: GetFcmAnalyticsInput): Promise<FcmAnalyticsReport> {
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

    const report: FcmAnalyticsReport = {
      section: input.section,
      range: {
        start: range.current.start,
        end: range.current.end,
        previousStart: range.previous.start,
        previousEnd: range.previous.end,
        days: range.days,
      },
      fcm: await this.run(input.section, range),
    };
    return report;
  }

  private async run(section: FcmAnalyticsSection, range: ResolvedRange): Promise<FcmProviderResult> {
    const { fcm, cacheTtlSeconds } = this.deps;
    if (!fcm.isConfigured()) {
      return { status: 'not_configured', errorCode: `${FCM_PREFIX}_NOT_CONFIGURED`, message: null, range: null, data: null };
    }
    const cacheKey = `fcm:${section}:${range.current.start}:${range.current.end}`;
    const cached = this.cache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) return cached.result;

    let result: FcmProviderResult;
    try {
      const data = section === 'delivery' ? await fcm.getDelivery(range) : await fcm.getEngagement(range);
      result = isEmpty(data as never)
        ? { status: 'empty', errorCode: null, message: null, range: range.current, data: null }
        : { status: 'ok', errorCode: null, message: null, range: range.current, data };
    } catch (err) {
      const kind: AnalyticsProviderErrorKind = err instanceof AnalyticsProviderError ? err.kind : 'upstream';
      logger.warn({ provider: 'fcm', kind, section, err: (err as Error).message }, 'fcm analytics provider gagal');
      return {
        status: 'error',
        errorCode: `${FCM_PREFIX}_${ERROR_SUFFIX[kind]}`,
        message: errorMessage(kind),
        range: range.current,
        data: null,
      };
    }

    if (cacheTtlSeconds > 0) this.cache.set(cacheKey, { result, expiresAt: Date.now() + cacheTtlSeconds * 1000 });
    return result;
  }
}
