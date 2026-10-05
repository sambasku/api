import type { FcmAnalyticsProvider } from '../application/ports/fcm-analytics.port';
import { FakeFcmAnalyticsProvider } from './fake-fcm-analytics.provider';
import { FcmAnalyticsProviderImpl } from './fcm-analytics.provider';

export interface FcmAnalyticsEnv {
  NODE_ENV: string;
  WEB_ANALYTICS_FAKE: boolean;
  FIREBASE_PROJECT_ID?: string;
  FIREBASE_CLIENT_EMAIL?: string;
  FIREBASE_PRIVATE_KEY?: string;
  GOOGLE_ANALYTICS_SA_EMAIL?: string;
  GOOGLE_ANALYTICS_SA_PRIVATE_KEY?: string;
  /** Property GA4 untuk data mobile (open rate). Boleh sama dengan web. */
  MOBILE_GA4_PROPERTY_ID?: string;
}

/**
 * Delivery FCM pakai service account Firebase (yang sama dengan pengirim
 * push); open rate pakai service account GA4. Delivery tanpa GA4 tetap
 * jalan (opened = 0). Env kosong = provider `not_configured`.
 */
export function createFcmAnalyticsProviders(env: FcmAnalyticsEnv): {
  fcm: FcmAnalyticsProvider;
} {
  if (env.WEB_ANALYTICS_FAKE && env.NODE_ENV !== 'production') {
    return { fcm: new FakeFcmAnalyticsProvider() };
  }
  const fcmEmail = env.FIREBASE_CLIENT_EMAIL?.trim();
  const fcmKey = env.FIREBASE_PRIVATE_KEY?.trim();
  const ga4Email = env.GOOGLE_ANALYTICS_SA_EMAIL?.trim();
  const ga4Key = env.GOOGLE_ANALYTICS_SA_PRIVATE_KEY?.trim();
  return {
    fcm: new FcmAnalyticsProviderImpl({
      fcmAccount: fcmEmail && fcmKey ? { clientEmail: fcmEmail, privateKey: fcmKey } : null,
      firebaseProjectId: env.FIREBASE_PROJECT_ID?.trim() || null,
      ga4Account: ga4Email && ga4Key ? { clientEmail: ga4Email, privateKey: ga4Key } : null,
      ga4PropertyId: env.MOBILE_GA4_PROPERTY_ID?.trim() || null,
    }),
  };
}
