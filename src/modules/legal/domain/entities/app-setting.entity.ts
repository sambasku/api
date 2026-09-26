/** Keys yang diizinkan di app_settings (admin PATCH whitelist). */
export const APP_SETTING_KEYS = [
  'oauth.third_party_registration',
  'oauth.request_log_retention_days',
  'legal.terms_version',
  'legal.privacy_version',
  'notification.review_approve_push_cooldown_minutes',
  'notification.review_reject_push_cooldown_minutes',
] as const;

export type AppSettingKey = (typeof APP_SETTING_KEYS)[number];

export const LEGAL_TERMS_VERSION_KEY = 'legal.terms_version' as const;
export const LEGAL_PRIVACY_VERSION_KEY = 'legal.privacy_version' as const;

export const REVIEW_APPROVE_PUSH_COOLDOWN_MINUTES_KEY =
  'notification.review_approve_push_cooldown_minutes' as const;
export const REVIEW_REJECT_PUSH_COOLDOWN_MINUTES_KEY =
  'notification.review_reject_push_cooldown_minutes' as const;

/** Default jika baris app_settings belum ada. 0 = cooldown mati. */
export const DEFAULT_REVIEW_PUSH_COOLDOWN_MINUTES = 360;

export interface AppSetting {
  key: string;
  value: string;
  updatedAt: Date;
  updatedBy: string | null;
}

export interface LegalActiveVersions {
  termsVersion: string;
  privacyVersion: string;
}
