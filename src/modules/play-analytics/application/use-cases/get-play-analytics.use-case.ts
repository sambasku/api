import { ValidationError } from '@/shared/errors/app-error';
import { logger } from '@/shared/logging/logger';
import {
  InvalidDateRangeError,
  resolveDateRange,
  type RangePreset,
} from '@/modules/web-analytics/domain/date-range';
import type {
  PlayAnalyticsReport,
  PlayAnalyticsSection,
  PlayProviderResult,
} from '../../domain/entities/play-analytics.entity';
import { AnalyticsProviderError, type AnalyticsProviderErrorKind, type PlayStatsProvider } from '../ports/play-analytics.port';
import type { ResolvedRange } from '@/modules/web-analytics/domain/entities/web-analytics.entity';

/** Export CSV Play final H+1..H+2; geser ujung rentang biar tidak selalu 0. */
export const PLAY_STATS_LAG_DAYS = 2;

export interface GetPlayAnalyticsInput {
  section: PlayAnalyticsSection;
  range: RangePreset;
  start?: string;
  end?: string;
}

const PLAY_PREFIX = 'PLAY';

const ERROR_SUFFIX: Record<AnalyticsProviderErrorKind, string> = {
  permission_denied: 'PERMISSION_DENIED',
  rate_limited: 'RATE_LIMITED',
  upstream: 'UPSTREAM_ERROR',
  network: 'NETWORK_ERROR',
};

function errorMessage(kind: AnalyticsProviderErrorKind): string {
  switch (kind) {
    case 'permission_denied':
      return 'Akses ke Play Console ditolak. Cek PLAY_STATS_GCS_BUCKET dan izin service account di bucket export.';
    case 'rate_limited':
      return 'Kuota Google Cloud Storage lagi penuh. Coba lagi beberapa menit lagi.';
    case 'upstream':
      return 'Play Console export lagi bermasalah. Coba lagi nanti.';
    case 'network':
      return 'Server gagal menghubungi Google Cloud Storage. Coba lagi sebentar lagi.';
  }
}

interface CacheEntry {
  expiresAt: number;
  result: PlayProviderResult;
}

function isEmpty(data: { totals: { newInstalls: number; activeInstalls: number; ratingCount: number } }): boolean {
  return data.totals.newInstalls === 0 && data.totals.activeInstalls === 0 && data.totals.ratingCount === 0;
}

/**
 * Orkestrasi section statistik Play. Error tidak pernah jadi 5xx endpoint:
 * status provider dikembalikan di dalam 200, pola sama dengan web-analytics.
 */
export class GetPlayAnalyticsUseCase {
  // ponytail: in-memory TTL cache, single-isolate - upgrade KV kalau multi-instance
  private readonly cache = new Map<string, CacheEntry>();

  constructor(
    private readonly deps: {
      play: PlayStatsProvider;
      cacheTtlSeconds: number;
      now?: () => Date;
    },
  ) {}

  async execute(input: GetPlayAnalyticsInput): Promise<PlayAnalyticsReport> {
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

    const report: PlayAnalyticsReport = {
      section: input.section,
      range: {
        start: range.current.start,
        end: range.current.end,
        previousStart: range.previous.start,
        previousEnd: range.previous.end,
        days: range.days,
      },
      play: await this.run(input.section, range),
    };
    return report;
  }

  private async run(section: PlayAnalyticsSection, range: ResolvedRange): Promise<PlayProviderResult> {
    const { play, cacheTtlSeconds } = this.deps;
    if (!play.isConfigured()) {
      return { status: 'not_configured', errorCode: `${PLAY_PREFIX}_NOT_CONFIGURED`, message: null, range: null, data: null };
    }
    const cacheKey = `play:${section}:${range.current.start}:${range.current.end}`;
    const cached = this.cache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) return cached.result;

    let result: PlayProviderResult;
    try {
      const data =
        section === 'overview'
          ? await play.getOverview(range)
          : section === 'growth'
            ? await play.getGrowth(range)
            : await play.getRatings(range);
      result = isEmpty(data as never)
        ? { status: 'empty', errorCode: null, message: null, range: range.current, data: null }
        : { status: 'ok', errorCode: null, message: null, range: range.current, data };
    } catch (err) {
      const kind: AnalyticsProviderErrorKind = err instanceof AnalyticsProviderError ? err.kind : 'upstream';
      logger.warn({ provider: 'play', kind, section, err: (err as Error).message }, 'play analytics provider gagal');
      return {
        status: 'error',
        errorCode: `${PLAY_PREFIX}_${ERROR_SUFFIX[kind]}`,
        message: errorMessage(kind),
        range: range.current,
        data: null,
      };
    }

    if (cacheTtlSeconds > 0) this.cache.set(cacheKey, { result, expiresAt: Date.now() + cacheTtlSeconds * 1000 });
    return result;
  }
}
