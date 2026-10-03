import type {
  SearchAnalyticsProvider,
  VisitorAnalyticsProvider,
} from '../application/ports/analytics-provider.port';
import { FakeSearchAnalyticsProvider, FakeVisitorAnalyticsProvider } from './fake-web-analytics.provider';
import { Ga4Provider } from './ga4.provider';
import { SearchConsoleProvider } from './search-console.provider';

export interface WebAnalyticsEnv {
  NODE_ENV: string;
  WEB_ANALYTICS_FAKE: boolean;
  GOOGLE_ANALYTICS_SA_EMAIL?: string;
  GOOGLE_ANALYTICS_SA_PRIVATE_KEY?: string;
  GA4_PROPERTY_ID?: string;
  SEARCH_CONSOLE_SITE_URL?: string;
}

/**
 * GA4 + Search Console berbagi satu service account. Env kosong = provider
 * `not_configured` (UI tampilkan "belum terhubung"), API tetap jalan.
 */
export function createWebAnalyticsProviders(env: WebAnalyticsEnv): {
  visitor: VisitorAnalyticsProvider;
  search: SearchAnalyticsProvider;
} {
  if (env.WEB_ANALYTICS_FAKE && env.NODE_ENV !== 'production') {
    return { visitor: new FakeVisitorAnalyticsProvider(), search: new FakeSearchAnalyticsProvider() };
  }
  const clientEmail = env.GOOGLE_ANALYTICS_SA_EMAIL?.trim();
  const privateKey = env.GOOGLE_ANALYTICS_SA_PRIVATE_KEY?.trim();
  const account = clientEmail && privateKey ? { clientEmail, privateKey } : null;
  return {
    visitor: new Ga4Provider({ account, propertyId: env.GA4_PROPERTY_ID?.trim() || null }),
    search: new SearchConsoleProvider({ account, siteUrl: env.SEARCH_CONSOLE_SITE_URL?.trim() || null }),
  };
}
