/**
 * Bentuk ternormalisasi analitik FCM (delivery dari FCM Data API + open rate
 * dari event `notification_open` di GA4 property mobile). Provider wajib
 * memetakan respons Google ke sini supaya struktur vendor tidak bocor ke
 * controller/console.
 */

export const FCM_ANALYTICS_SECTIONS = ['delivery', 'engagement'] as const;
export type FcmAnalyticsSection = (typeof FCM_ANALYTICS_SECTIONS)[number];

export interface FcmTotals {
  /** Pesan diteruskan FCM ke perangkat pada rentang. */
  sent: number;
  /** Pesan terkirim ke perangkat (acks FCM). */
  delivered: number;
  /** Pesan gagal diteruskan. */
  failed: number;
  /** Event `notification_open` dari Firebase Analytics (via GA4). */
  opened: number;
  /** Rasio open 0..1 terhadap delivered; 0 kalau delivered 0. */
  openRate: number;
}

export interface FcmTrendPoint {
  date: string;
  sent: number;
  delivered: number;
  opened: number;
}

export interface FcmDelivery {
  totals: FcmTotals;
  previous: FcmTotals;
  trend: FcmTrendPoint[];
  /** Data delivery terbaru umumnya H-1; tanggal terakhir yang punya angka. */
  latestDataDate: string | null;
}

export interface FcmEngagement {
  totals: FcmTotals;
  previous: FcmTotals;
  trend: FcmTrendPoint[];
  /** Rata-rata engagement_duration_msec (detik) setelah buka notifikasi. */
  avgEngagementSeconds: number;
}

export type FcmProviderStatus = 'ok' | 'empty' | 'not_configured' | 'error';

export interface FcmProviderResult<T = unknown> {
  status: FcmProviderStatus;
  errorCode: string | null;
  message: string | null;
  range: { start: string; end: string } | null;
  data: T | null;
}

export interface FcmAnalyticsReport {
  section: FcmAnalyticsSection;
  range: {
    start: string;
    end: string;
    previousStart: string;
    previousEnd: string;
    days: number;
  };
  fcm: FcmProviderResult;
}
