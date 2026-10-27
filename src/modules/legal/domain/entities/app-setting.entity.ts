/** Keys yang diizinkan di app_settings (admin PATCH whitelist). */
export const APP_SETTING_KEYS = [
  'oauth.third_party_registration',
  'oauth.request_log_retention_days',
  'legal.terms_version',
  'legal.privacy_version',
  'legal.oauth_consent_enforcement',
  'notification.review_approve_push_cooldown_minutes',
  'notification.review_reject_push_cooldown_minutes',
  'notification.word_comment_push_cooldown_minutes',
  'notification.word_vote_push_cooldown_minutes',
  'notification.word_media_push_cooldown_minutes',
  'wa.verifier_enabled',
  'wa.group_cta_url',
  /** Kill switch pengingat aktivitas (leveling/streak). Default off sampai dry-run. */
  'streak_reminder_enabled',
] as const;

export type AppSettingKey = (typeof APP_SETTING_KEYS)[number];

export const LEGAL_TERMS_VERSION_KEY = 'legal.terms_version' as const;
export const LEGAL_PRIVACY_VERSION_KEY = 'legal.privacy_version' as const;
export const LEGAL_OAUTH_CONSENT_ENFORCEMENT_KEY =
  'legal.oauth_consent_enforcement' as const;

/** Mode enforcement consent OAuth (lihat docs/api/44-api-consent-oauth.md). */
export type OauthConsentEnforcement = 'lenient' | 'enforce';

/** Default saat baris belum ada: app lama masih beredar. */
export const DEFAULT_OAUTH_CONSENT_ENFORCEMENT: OauthConsentEnforcement = 'lenient';

/** Default link grup WA (diskusi + silaturahmi) untuk CTA pesan WA verifikator. */
export const DEFAULT_WA_GROUP_CTA_URL =
  'https://chat.whatsapp.com/Kw64lxFEGXfK5gw6T6GEoN?mode=gi_t';
export const WA_VERIFIER_ENABLED_KEY = 'wa.verifier_enabled' as const;
export const WA_GROUP_CTA_URL_KEY = 'wa.group_cta_url' as const;

export const REVIEW_APPROVE_PUSH_COOLDOWN_MINUTES_KEY =
  'notification.review_approve_push_cooldown_minutes' as const;
export const REVIEW_REJECT_PUSH_COOLDOWN_MINUTES_KEY =
  'notification.review_reject_push_cooldown_minutes' as const;
export const WORD_COMMENT_PUSH_COOLDOWN_MINUTES_KEY =
  'notification.word_comment_push_cooldown_minutes' as const;
export const WORD_VOTE_PUSH_COOLDOWN_MINUTES_KEY =
  'notification.word_vote_push_cooldown_minutes' as const;
/** #133: notif media anak kata (contoh kalimat / audio pelafalan). */
export const WORD_MEDIA_PUSH_COOLDOWN_MINUTES_KEY =
  'notification.word_media_push_cooldown_minutes' as const;

/** Default jika baris app_settings belum ada. 0 = cooldown mati. */
export const DEFAULT_REVIEW_PUSH_COOLDOWN_MINUTES = 360;

/** Default jeda push diskusi komentar (mode Skip). */
export const DEFAULT_WORD_COMMENT_PUSH_COOLDOWN_MINUTES = 3;

/** Default jeda push vote pada kosakata (mode Skip). */
export const DEFAULT_WORD_VOTE_PUSH_COOLDOWN_MINUTES = 3;

/** Default jeda push media anak kata (#133, mode Skip). */
export const DEFAULT_WORD_MEDIA_PUSH_COOLDOWN_MINUTES = 3;

export type AppSettingType = 'string' | 'boolean' | 'number' | 'url';

export interface AppSetting {
  key: string;
  value: string;
  type: AppSettingType;
  description: string | null;
  updatedAt: Date;
  updatedBy: string | null;
}

export interface LegalActiveVersions {
  termsVersion: string;
  privacyVersion: string;
}
