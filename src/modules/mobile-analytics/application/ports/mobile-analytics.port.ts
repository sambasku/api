import type {
  MobileAudience,
  MobileEvents,
  MobileOverview,
  MobileScreens,
} from '../../domain/entities/mobile-analytics.entity';
import type { ResolvedRange } from '@/modules/web-analytics/domain/entities/web-analytics.entity';

/** Port provider analitik GA4 mobile (app screens, events, audience). */
export interface MobileAnalyticsProvider {
  isConfigured(): boolean;
  getOverview(range: ResolvedRange): Promise<MobileOverview>;
  getEvents(range: ResolvedRange): Promise<MobileEvents>;
  getScreens(range: ResolvedRange): Promise<MobileScreens>;
  getAudience(range: ResolvedRange): Promise<MobileAudience>;
}

export type MobileAnalyticsProviderErrorKind = 'permission_denied' | 'rate_limited' | 'upstream' | 'network';

/** Kegagalan vendor yang sudah diklasifikasi. */
export class MobileAnalyticsProviderError extends Error {
  constructor(
    readonly kind: MobileAnalyticsProviderErrorKind,
    message: string,
  ) {
    super(message);
    this.name = 'MobileAnalyticsProviderError';
  }
}
