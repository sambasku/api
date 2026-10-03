import type {
  Ga4Behavior,
  Ga4Overview,
  Ga4Sources,
  Ga4Visitors,
  ResolvedRange,
  SearchDetail,
  SearchFilters,
  SearchOverview,
} from '../../domain/entities/web-analytics.entity';

/** Data pengunjung & perilaku (hari ini: GA4). */
export interface VisitorAnalyticsProvider {
  isConfigured(): boolean;
  getOverview(range: ResolvedRange): Promise<Ga4Overview>;
  getVisitors(range: ResolvedRange): Promise<Ga4Visitors>;
  getBehavior(range: ResolvedRange): Promise<Ga4Behavior>;
  getSources(range: ResolvedRange): Promise<Ga4Sources>;
}

/** Performa pencarian organik (hari ini: Google Search Console). */
export interface SearchAnalyticsProvider {
  isConfigured(): boolean;
  getOverview(range: ResolvedRange): Promise<SearchOverview>;
  getSearch(range: ResolvedRange, filters?: SearchFilters): Promise<SearchDetail>;
}

export type AnalyticsProviderErrorKind = 'permission_denied' | 'rate_limited' | 'upstream' | 'network';

/** Kegagalan vendor yang sudah diklasifikasi - use case memetakan ke error_code. */
export class AnalyticsProviderError extends Error {
  constructor(
    readonly kind: AnalyticsProviderErrorKind,
    message: string,
  ) {
    super(message);
    this.name = 'AnalyticsProviderError';
  }
}
