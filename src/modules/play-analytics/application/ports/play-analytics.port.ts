import type {
  PlayGrowth,
  PlayOverview,
  PlayRatings,
} from '../../domain/entities/play-analytics.entity';
import type { ResolvedRange } from '@/modules/web-analytics/domain/entities/web-analytics.entity';

/**
 * Port provider statistik Play Console. Error dinormalisasi ke
 * AnalyticsProviderError (pola sama dengan web-analytics).
 */
export interface PlayStatsProvider {
  isConfigured(): boolean;
  getOverview(range: ResolvedRange): Promise<PlayOverview>;
  getGrowth(range: ResolvedRange): Promise<PlayGrowth>;
  getRatings(range: ResolvedRange): Promise<PlayRatings>;
}

export type AnalyticsProviderErrorKind =
  | 'permission_denied'
  | 'rate_limited'
  | 'upstream'
  | 'network';

/** Satu error untuk semua kegagalan provider Play. */
export class AnalyticsProviderError extends Error {
  constructor(
    readonly kind: AnalyticsProviderErrorKind,
    message: string,
  ) {
    super(message);
    this.name = 'AnalyticsProviderError';
  }
}
