import { getGoogleAccessToken, GoogleTokenError, type GoogleServiceAccount } from '@/shared/google/service-account-token';
import { AnalyticsProviderError } from '../application/ports/fcm-analytics.port';
import type { DateRange, ResolvedRange } from '@/modules/web-analytics/domain/entities/web-analytics.entity';
import type {
  FcmDelivery,
  FcmEngagement,
  FcmTotals,
  FcmTrendPoint,
} from '../domain/entities/fcm-analytics.entity';

const FCM_DATA_SCOPE = 'https://www.googleapis.com/auth/cloud-platform';
const GA4_SCOPE = 'https://www.googleapis.com/auth/analytics.readonly';
const TIMEOUT_MS = 10_000;
/** FCM Data API cuma menyimpan ~14 hari terakhir. */
export const FCM_DATA_RETENTION_DAYS = 14;

function kindForStatus(status: number): AnalyticsProviderError['kind'] {
  if (status === 401 || status === 403) return 'permission_denied';
  if (status === 429) return 'rate_limited';
  return 'upstream';
}

function toError(err: unknown): AnalyticsProviderError {
  if (err instanceof AnalyticsProviderError) return err;
  if (err instanceof GoogleTokenError) {
    const kind = err.status === 0 ? 'network' : err.status >= 500 ? 'upstream' : 'permission_denied';
    return new AnalyticsProviderError(kind, err.message);
  }
  return new AnalyticsProviderError('upstream', (err as Error).message);
}

async function postJson<T>(account: GoogleServiceAccount, scope: string, url: string, body?: unknown): Promise<T> {
  let token: string;
  try {
    token = await getGoogleAccessToken(account, scope);
  } catch (err) {
    throw toError(err);
  }
  let res: Response;
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch (err) {
    throw new AnalyticsProviderError('network', (err as Error).message);
  }
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new AnalyticsProviderError(kindForStatus(res.status), `status=${res.status} ${text.slice(0, 300)}`);
  }
  try {
    return (await res.json()) as T;
  } catch {
    throw new AnalyticsProviderError('upstream', 'Respons Google bukan JSON');
  }
}

interface FcmDailyDatum {
  date: { year: number; month: number; day: number };
  count: string;
  // ponytail: deliveryErrors tidak dipakai UI dulu - tambah kalau admin minta rincian gagal per alasan
  deliveryErrors?: Array<{ errorCode: string; count: string }>;
}

interface FcmDeliveryDataResponse {
  data?: FcmDailyDatum[];
  nextPageToken?: string;
}

function datumToYmd(d: FcmDailyDatum): string {
  const p = (n: number, w: number) => String(n).padStart(w, '0');
  return `${d.date.year}-${p(d.date.month, 2)}-${p(d.date.day, 2)}`;
}

/** Agregat totals dari kumpulan titik harian. */
export function totalsFromTrend(trend: FcmTrendPoint[]): FcmTotals {
  const sum = (k: 'sent' | 'delivered' | 'opened') => trend.reduce((s, p) => s + p[k], 0);
  const sent = sum('sent');
  const delivered = sum('delivered');
  const opened = sum('opened');
  return { sent, delivered, failed: Math.max(0, sent - delivered), opened, openRate: delivered > 0 ? opened / delivered : 0 };
}

/**
 * Delivery FCM dari FCM Data API + open rate dari event `notification_open`
 * di GA4 (property mobile). Env GA4 kosong -> opened/openRate tetap 0,
 * delivery tetap tampil.
 */
export class FcmAnalyticsProviderImpl {
  constructor(
    private readonly config: {
      /** Service account FCM (FIREBASE_*) - wajib untuk delivery data. */
      fcmAccount: GoogleServiceAccount | null;
      firebaseProjectId: string | null;
      /** Service account GA4 + property mobile - opsional, untuk open rate. */
      ga4Account: GoogleServiceAccount | null;
      ga4PropertyId: string | null;
    },
  ) {}

  isConfigured(): boolean {
    return Boolean(this.config.fcmAccount && this.config.firebaseProjectId);
  }

  async getDelivery(range: ResolvedRange): Promise<FcmDelivery> {
    const [current, previous, latestDataDate, opened] = await Promise.all([
      this.deliveryDays(range.current),
      this.deliveryDays(range.previous),
      this.latestDataDate(),
      this.openedByDay(unionDays(range)),
    ]);
    const trend = current.days.map((d) => ({ ...d, opened: opened.get(d.date) ?? 0 }));
    const prevTrend = previous.days.map((d) => ({ ...d, opened: opened.get(d.date) ?? 0 }));
    return {
      totals: totalsFromTrend(trend),
      previous: totalsFromTrend(prevTrend),
      trend,
      latestDataDate,
    };
  }

  async getEngagement(range: ResolvedRange): Promise<FcmEngagement> {
    const delivery = await this.getDelivery(range);
    const avgSeconds = await this.avgEngagementSeconds(range.current);
    return {
      totals: delivery.totals,
      previous: delivery.previous,
      trend: delivery.trend,
      avgEngagementSeconds: avgSeconds,
    };
  }

  /** Hari-hari delivery FCM untuk satu rentang (paginasi semua halaman). */
  private async deliveryDays(range: DateRange): Promise<{ days: FcmTrendPoint[] }> {
    const { fcmAccount, firebaseProjectId } = this.config;
    if (!fcmAccount || !firebaseProjectId) throw new Error('FcmAnalyticsProviderImpl dipanggil tanpa konfigurasi');
    const url = `https://fcm.googleapis.com/v1/projects/${encodeURIComponent(firebaseProjectId)}/deliveryData`;
    // ponytail: endpoint ini cuma punya variant ALL_DATA; rentang difilter lokal
    const byDate = new Map<string, FcmTrendPoint>();
    let pageToken: string | undefined;
    do {
      const res = await postJson<FcmDeliveryDataResponse>(fcmAccount, FCM_DATA_SCOPE, url, {
        pageToken,
      }).catch((err) => {
        throw toError(err);
      });
      for (const d of res.data ?? []) {
        const date = datumToYmd(d);
        if (date < range.start || date > range.end) continue;
        const count = Number(d.count) || 0;
        const prev = byDate.get(date) ?? { date, sent: 0, delivered: 0, opened: 0 };
        prev.sent += count;
        // FCM Data API: baris tanpa deliveryErrors = semua terkirim.
        if (!d.deliveryErrors || d.deliveryErrors.length === 0) prev.delivered += count;
        byDate.set(date, prev);
      }
      pageToken = res.nextPageToken;
    } while (pageToken);
    return { days: daysInRange(range).map((date) => byDate.get(date) ?? { date, sent: 0, delivered: 0, opened: 0 }) };
  }

  /** Tanggal data terakhir (lazy H-1) - untuk catatan UI. */
  private async latestDataDate(): Promise<string | null> {
    const { fcmAccount, firebaseProjectId } = this.config;
    if (!fcmAccount || !firebaseProjectId) return null;
    const url = `https://fcm.googleapis.com/v1/projects/${encodeURIComponent(firebaseProjectId)}/deliveryData`;
    try {
      const res = await postJson<FcmDeliveryDataResponse>(fcmAccount, FCM_DATA_SCOPE, url, {});
      const dates = (res.data ?? []).map(datumToYmd).sort();
      return dates[dates.length - 1] ?? null;
    } catch {
      return null;
    }
  }

  /** Event `notification_open` per hari dari GA4. Kosong kalau GA4 tak diset. */
  private async openedByDay(days: string[]): Promise<Map<string, number>> {
    const out = new Map<string, number>();
    const { ga4Account, ga4PropertyId } = this.config;
    if (!ga4Account || !ga4PropertyId || days.length === 0) return out;
    const res = await postJson<{ rows?: Array<{ dimensionValues?: Array<{ value?: string }>; metricValues?: Array<{ value?: string }> }> }>(
      ga4Account,
      GA4_SCOPE,
      `https://analyticsdata.googleapis.com/v1beta/properties/${encodeURIComponent(ga4PropertyId)}:runReport`,
      {
        dateRanges: [{ startDate: days[0], endDate: days[days.length - 1] }],
        dimensions: [{ name: 'date' }],
        metrics: [{ name: 'eventCount' }],
        dimensionFilter: {
          filter: { fieldName: 'eventName', stringFilter: { matchType: 'EXACT', value: 'notification_open' } },
        },
        orderBys: [{ dimension: { dimensionName: 'date' } }],
        limit: 400,
      },
    ).catch((err) => {
      throw toError(err);
    });
    for (const row of res.rows ?? []) {
      const raw = row.dimensionValues?.[0]?.value ?? '';
      const date = /^\d{8}$/.test(raw) ? `${raw.slice(0, 4)}-${raw.slice(4, 6)}-${raw.slice(6, 8)}` : raw;
      out.set(date, Number(row.metricValues?.[0]?.value ?? 0) || 0);
    }
    return out;
  }

  /** Rata-rata durasi engagement (detik) untuk event notification_open. */
  private async avgEngagementSeconds(range: DateRange): Promise<number> {
    const { ga4Account, ga4PropertyId } = this.config;
    if (!ga4Account || !ga4PropertyId) return 0;
    const res = await postJson<{ rows?: Array<{ metricValues?: Array<{ value?: string }> }> }>(
      ga4Account,
      GA4_SCOPE,
      `https://analyticsdata.googleapis.com/v1beta/properties/${encodeURIComponent(ga4PropertyId)}:runReport`,
      {
        dateRanges: [{ startDate: range.start, endDate: range.end }],
        metrics: [{ name: 'userEngagementDuration' }, { name: 'eventCount' }],
        dimensionFilter: {
          filter: { fieldName: 'eventName', stringFilter: { matchType: 'EXACT', value: 'notification_open' } },
        },
        limit: 1,
      },
    ).catch((err) => {
      throw toError(err);
    });
    const totalMs = Number(res.rows?.[0]?.metricValues?.[0]?.value ?? 0) || 0;
    const count = Number(res.rows?.[0]?.metricValues?.[1]?.value ?? 0) || 0;
    return count > 0 ? Math.round(totalMs / count / 1000) : 0;
  }
}

function daysInRange(range: DateRange): string[] {
  const out: string[] = [];
  for (let d = range.start; d <= range.end; d = nextDay(d)) out.push(d);
  return out;
}

function nextDay(ymd: string): string {
  return new Date(Date.parse(`${ymd}T00:00:00Z`) + 86_400_000).toISOString().slice(0, 10);
}

/** Union tanggal dari current + previous range (untuk satu query GA4). */
function unionDays(range: ResolvedRange): string[] {
  return [...daysInRange(range.previous), ...daysInRange(range.current)].sort();
}