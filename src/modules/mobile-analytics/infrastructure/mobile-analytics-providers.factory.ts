import type { MobileAnalyticsProvider } from '../application/ports/mobile-analytics.port';
import { MobileAnalyticsProviderImpl } from './mobile-analytics-provider';
import { FakeMobileAnalyticsProvider } from './fake-mobile-analytics.provider';

export interface MobileAnalyticsEnv {
  NODE_ENV: string;
  WEB_ANALYTICS_FAKE: boolean;
  GOOGLE_ANALYTICS_SA_EMAIL?: string;
  GOOGLE_ANALYTICS_SA_PRIVATE_KEY?: string;
  MOBILE_GA4_PROPERTY_ID?: string;
}

/**
 * GA4 property mobile (linked ke Firebase project). Env kosong = provider
 * `not_configured` (UI tampilkan "belum terhubung"), API tetap jalan.
 */
export function createMobileAnalyticsProvider(env: MobileAnalyticsEnv): MobileAnalyticsProvider {
  if (env.WEB_ANALYTICS_FAKE && env.NODE_ENV !== 'production') {
    return new FakeMobileAnalyticsProvider();
  }
  const clientEmail = env.GOOGLE_ANALYTICS_SA_EMAIL?.trim();
  const privateKey = env.GOOGLE_ANALYTICS_SA_PRIVATE_KEY?.trim();
  const account = clientEmail && privateKey ? { clientEmail, privateKey } : null;
  return new MobileAnalyticsProviderImpl({
    account,
    propertyId: env.MOBILE_GA4_PROPERTY_ID?.trim() || null,
  });
}
