import type {
  FcmDelivery,
  FcmEngagement,
} from '../../domain/entities/fcm-analytics.entity';
import type { ResolvedRange } from '@/modules/web-analytics/domain/entities/web-analytics.entity';

/**
 * Port provider analitik FCM. Error dinormalisasi ke AnalyticsProviderError
 * (pola sama dengan web-analytics dan play-analytics).
 */
export interface FcmAnalyticsProvider {
  isConfigured(): boolean;
  getDelivery(range: ResolvedRange): Promise<FcmDelivery>;
  getEngagement(range: ResolvedRange): Promise<FcmEngagement>;
}

export type AnalyticsProviderErrorKind =
  | 'permission_denied'
  | 'rate_limited'
  | 'upstream'
  | 'network';

/** Satu error untuk semua kegagalan provider FCM analytics. */
export class AnalyticsProviderError extends Error {
  constructor(
    readonly kind: AnalyticsProviderErrorKind,
    message: string,
  ) {
    super(message);
    this.name = 'AnalyticsProviderError';
  }
}
