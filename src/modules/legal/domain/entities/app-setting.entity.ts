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
  /** Master switch semua pesan WA keluar (grup, verifikator, Baleho). Default false. */
  'wa_group_notify_enabled',
  /** Kill switch pengingat aktivitas (leveling/streak). Default off sampai dry-run. */
  'streak_reminder_enabled',
  /** Tarif Baleho: rupiah per sel 1x1 per hari. */
  'baleho.price_per_cell_per_day',
  /** Experimental LiveKit voice room. false = strip mobile disembunyikan. */
  'voice.room_enabled',
  /**
   * Trust makna / Hot loop (docs/produk/trust-makna-hot-loop.md).
   * Default false sampai gelombang terkait live; admin boleh nyalakan per env.
   */
  'auto_verify_by_vote_enabled',
  'search_miss_auto_visible_enabled',
  'vote_reset_on_edit_enabled',
  'voting_warga_net_threshold',
  'voting_warga_unique_voters_threshold',
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
  'https://chat.whatsapp.com/Kw64lxFEGXfK5gw6T6GEoN?mode=gi_t&utm_source=sambasku.com&utm_medium=referral';
export const WA_VERIFIER_ENABLED_KEY = 'wa.verifier_enabled' as const;
export const WA_GROUP_CTA_URL_KEY = 'wa.group_cta_url' as const;
export const WA_GROUP_NOTIFY_ENABLED_KEY = 'wa_group_notify_enabled' as const;

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

export const BALEHO_PRICE_PER_CELL_PER_DAY_KEY =
  'baleho.price_per_cell_per_day' as const;

export const VOICE_ROOM_ENABLED_KEY = 'voice.room_enabled' as const;

/** Auto-verif makna oleh Voting Warga saat quorum vote tercapai. */
export const AUTO_VERIFY_BY_VOTE_ENABLED_KEY =
  'auto_verify_by_vote_enabled' as const;
/** Search miss baru auto `is_visible` bila lolos blocklist/quality. */
export const SEARCH_MISS_AUTO_VISIBLE_ENABLED_KEY =
  'search_miss_auto_visible_enabled' as const;
/** Reset vote + archive saat usulan/edit verifikator mengubah makna. */
export const VOTE_RESET_ON_EDIT_ENABLED_KEY =
  'vote_reset_on_edit_enabled' as const;
/** Ambang net vote Voting Warga (auto-verif ≥ N, dispute/tolak ≤ -N). */
export const VOTING_WARGA_NET_THRESHOLD_KEY =
  'voting_warga_net_threshold' as const;
/** Unique voters minimum untuk quorum Voting Warga. */
export const VOTING_WARGA_UNIQUE_VOTERS_THRESHOLD_KEY =
  'voting_warga_unique_voters_threshold' as const;

/** Default kill switch trust-loop: mati sampai gelombang terkait di-ship. */
export const DEFAULT_AUTO_VERIFY_BY_VOTE_ENABLED = false;
export const DEFAULT_SEARCH_MISS_AUTO_VISIBLE_ENABLED = false;
export const DEFAULT_VOTE_RESET_ON_EDIT_ENABLED = false;
/** Default ambang dari konstanta TS (voting-warga.ts) bila baris settings belum ada. */
export const DEFAULT_VOTING_WARGA_NET_THRESHOLD = 5;
export const DEFAULT_VOTING_WARGA_UNIQUE_VOTERS_THRESHOLD = 5;

/** Default tarif Baleho (IDR): 1x1 / hari. */
export const DEFAULT_BALEHO_PRICE_PER_CELL_PER_DAY = 3000;

export type AppSettingType = 'string' | 'boolean' | 'number' | 'url';

/**
 * Tipe kanonik per key (Console System Config pakai ini untuk editor).
 * Semua `*_enabled` = boolean supaya seragam Switch/Select Aktif-Nonaktif.
 */
export const APP_SETTING_KEY_TYPES: Record<AppSettingKey, AppSettingType> = {
  'oauth.third_party_registration': 'string',
  'oauth.request_log_retention_days': 'number',
  'legal.terms_version': 'string',
  'legal.privacy_version': 'string',
  'legal.oauth_consent_enforcement': 'string',
  'notification.review_approve_push_cooldown_minutes': 'number',
  'notification.review_reject_push_cooldown_minutes': 'number',
  'notification.word_comment_push_cooldown_minutes': 'number',
  'notification.word_vote_push_cooldown_minutes': 'number',
  'notification.word_media_push_cooldown_minutes': 'number',
  'wa.verifier_enabled': 'boolean',
  'wa.group_cta_url': 'url',
  wa_group_notify_enabled: 'boolean',
  streak_reminder_enabled: 'boolean',
  'baleho.price_per_cell_per_day': 'number',
  'voice.room_enabled': 'boolean',
  auto_verify_by_vote_enabled: 'boolean',
  search_miss_auto_visible_enabled: 'boolean',
  vote_reset_on_edit_enabled: 'boolean',
  voting_warga_net_threshold: 'number',
  voting_warga_unique_voters_threshold: 'number',
};

/** Keys kill-switch / flag on-off (validasi value true|false + type boolean). */
export const APP_SETTING_BOOLEAN_KEYS = (
  Object.entries(APP_SETTING_KEY_TYPES) as [AppSettingKey, AppSettingType][]
)
  .filter(([, t]) => t === 'boolean')
  .map(([k]) => k);

export function appSettingTypeForKey(key: string): AppSettingType {
  return (
    (APP_SETTING_KEY_TYPES as Record<string, AppSettingType | undefined>)[key] ??
    'string'
  );
}

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
