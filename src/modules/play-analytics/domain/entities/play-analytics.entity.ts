/**
 * Bentuk ternormalisasi statistik Google Play Console (instal & rating dari
 * export CSV Google Cloud Storage). Provider wajib memetakan CSV vendor ke
 * sini supaya struktur Google tidak bocor ke controller/console.
 */

export const PLAY_ANALYTICS_SECTIONS = ['overview', 'growth', 'ratings'] as const;
export type PlayAnalyticsSection = (typeof PLAY_ANALYTICS_SECTIONS)[number];

export interface PlayTotals {
  /** Instal baru pada rentang (device). */
  newInstalls: number;
  /** Instal aktif bersih di akhir rentang (device). */
  activeInstalls: number;
  uninstalls: number;
  updates: number;
  /** Rata-rata rating berbobot, 0..5. */
  averageRating: number;
  ratingCount: number;
}

export interface PlayTrendPoint {
  date: string;
  installs: number;
  uninstalls: number;
}

export interface PlayCountryRow {
  country: string;
  installs: number;
}

export interface PlayOverview {
  totals: PlayTotals;
  previous: PlayTotals;
  trend: PlayTrendPoint[];
  topCountries: PlayCountryRow[];
}

export interface PlayGrowth extends PlayOverview {
  /** Net growth per hari = installs - uninstalls. */
  netTrend: Array<{ date: string; net: number }>;
}

export interface PlayRatingBucket {
  stars: 1 | 2 | 3 | 4 | 5;
  count: number;
  share: number;
}

export interface PlayRatings {
  totals: PlayTotals;
  previous: PlayTotals;
  buckets: PlayRatingBucket[];
}

export type PlayProviderStatus = 'ok' | 'empty' | 'not_configured' | 'error';

export interface PlayProviderResult<T = unknown> {
  status: PlayProviderStatus;
  errorCode: string | null;
  message: string | null;
  range: { start: string; end: string } | null;
  data: T | null;
}

export interface PlayAnalyticsReport {
  section: PlayAnalyticsSection;
  range: {
    start: string;
    end: string;
    previousStart: string;
    previousEnd: string;
    days: number;
  };
  play: PlayProviderResult;
}
