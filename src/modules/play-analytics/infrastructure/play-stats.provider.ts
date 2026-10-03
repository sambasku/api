import type { PlayStatsProvider } from '../application/ports/play-analytics.port';
import type { DateRange } from '@/modules/web-analytics/domain/entities/web-analytics.entity';
import type {
  PlayGrowth,
  PlayOverview,
  PlayRatingBucket,
  PlayRatings,
  PlayTotals,
} from '../domain/entities/play-analytics.entity';
import { isOverviewCsv, isRelevantPlayCsv, parsePlayStatsCsv, playCsvMonth, type PlayCsvRow } from '../domain/play-csv';
import { downloadGcsObject, listGcsObjects } from './gcs-http';

/**
 * Provider statistik Play Console dari export CSV harian di Google Cloud
 * Storage (Play Console -> Download reports -> Statistics -> Cloud Storage).
 * Data final H+1..H+2; hari ini & kemarin lazim belum ada.
 */

/** Agregat per rentang dari baris CSV overview (sudah per hari). */
export function totalsFromRows(rows: PlayCsvRow[]): PlayTotals {
  if (rows.length === 0) {
    return { newInstalls: 0, activeInstalls: 0, uninstalls: 0, updates: 0, averageRating: 0, ratingCount: 0 };
  }
  // File overview: satu baris per hari. activeInstalls = nilai hari terakhir.
  const sorted = [...rows].sort((a, b) => a.date.localeCompare(b.date));
  const last = sorted[sorted.length - 1]!;
  const sum = (k: 'dailyInstalls' | 'dailyUninstalls' | 'updates') => sorted.reduce((s, r) => s + r[k], 0);
  // Rating harian berbobot jumlah ulasan; kumulatif dari baris terakhir.
  let wSum = 0;
  let wCount = 0;
  for (const r of sorted) {
    if (r.averageRating !== null && r.ratingCount > 0) {
      wSum += r.averageRating * r.ratingCount;
      wCount += r.ratingCount;
    }
  }
  return {
    newInstalls: sum('dailyInstalls'),
    uninstalls: sum('dailyUninstalls'),
    updates: sum('updates'),
    activeInstalls: last.activeInstalls,
    averageRating: last.totalAverageRating ?? (wCount > 0 ? wSum / wCount : 0),
    ratingCount: last.totalRatingCount,
  };
}

export function trendFromRows(rows: PlayCsvRow[], range: DateRange) {
  const byDate = new Map(rows.map((r) => [r.date, r]));
  const out: Array<{ date: string; installs: number; uninstalls: number }> = [];
  for (let d = range.start; d <= range.end; d = nextDay(d)) {
    const r = byDate.get(d);
    out.push({ date: d, installs: r?.dailyInstalls ?? 0, uninstalls: r?.dailyUninstalls ?? 0 });
  }
  return out;
}

function nextDay(ymd: string): string {
  return new Date(Date.parse(`${ymd}T00:00:00Z`) + 86_400_000).toISOString().slice(0, 10);
}

/** Negara: file country kumulatif per bulan - pakai snapshot terakhir dalam rentang. */
export function countriesFromRows(rows: PlayCsvRow[], range: DateRange) {
  const inRange = rows.filter((r) => r.date >= range.start && r.date <= range.end && r.country);
  const latest = inRange.reduce<string>((acc, r) => (r.date > acc ? r.date : acc), '');
  const byCountry = new Map<string, number>();
  for (const r of inRange) {
    if (r.date !== latest) continue;
    byCountry.set(r.country, (byCountry.get(r.country) ?? 0) + r.dailyInstalls);
  }
  return [...byCountry.entries()]
    .map(([country, installs]) => ({ country, installs }))
    .sort((a, b) => b.installs - a.installs)
    .slice(0, 10);
}

function ratingBuckets(rows: PlayCsvRow[], range: DateRange): PlayRatingBucket[] {
  // Export standard tidak menyertakan distribusi bintang; kosong dulu.
  // ponytail: distribusi bintang asli butuh Play Developer Reporting API (reviews cluster) - tambah kalau admin butuh
  void rows;
  void range;
  return [];
}

export interface PlayStatsConfig {
  account: { clientEmail: string; privateKey: string } | null;
  bucket: string | null;
  /** Prefix object di bucket, mis: stats/installs. */
  prefix: string;
}

export class GcsPlayStatsProvider implements PlayStatsProvider {
  constructor(private readonly config: PlayStatsConfig) {}

  isConfigured(): boolean {
    return Boolean(this.config.account && this.config.bucket);
  }

  async getOverview(range: { current: DateRange; previous: DateRange }): Promise<PlayOverview> {
    const [cur, prev] = await Promise.all([this.loadRange(range.current), this.loadRange(range.previous)]);
    const trend = trendFromRows(cur.rows, range.current);
    return {
      totals: totalsFromRows(cur.rows),
      previous: totalsFromRows(prev.rows),
      trend,
      topCountries: countriesFromRows(cur.rows, range.current),
    };
  }

  async getGrowth(range: { current: DateRange; previous: DateRange }): Promise<PlayGrowth> {
    const base = await this.getOverview(range);
    return {
      ...base,
      netTrend: base.trend.map((p) => ({ date: p.date, net: p.installs - p.uninstalls })),
    };
  }

  async getRatings(range: { current: DateRange; previous: DateRange }): Promise<PlayRatings> {
    const [cur, prev] = await Promise.all([this.loadRange(range.current), this.loadRange(range.previous)]);
    const buckets = ratingBuckets(cur.rows, range.current);
    return { totals: totalsFromRows(cur.rows), previous: totalsFromRows(prev.rows), buckets };
  }

  /** Unduh semua file bulan yang menutupi rentang (overview + country). */
  private async loadRange(range: DateRange): Promise<{ rows: PlayCsvRow[] }> {
    const { account, bucket, prefix } = this.config;
    if (!account || !bucket) throw new Error('PlayStatsProvider dipanggil tanpa konfigurasi');
    const months = monthsCovering(range);
    const wanted = new Set(months);
    const all: PlayCsvRow[] = [];

    let pageToken: string | undefined;
    do {
      const list = await listGcsObjects(account, bucket, prefix, pageToken ? { pageToken } : {});
      const matches = list.objects.filter(
        (o) => isRelevantPlayCsv(o) && playCsvMonth(o) !== null && wanted.has(playCsvMonth(o)!),
      );
      for (const name of matches) {
        const csv = await downloadGcsObject(account, bucket, name);
        const rows = parsePlayStatsCsv(csv);
        // File country berisi baris kumulatif bulan; simpan asal - agregator pilih.
        all.push(...rows.filter((r) => (isOverviewCsv(name) ? true : Boolean(r.country))));
      }
      pageToken = list.nextPageToken ?? undefined;
    } while (pageToken);
    return { rows: all };
  }
}

/** YYYYMM bulan-bulan yang menutupi rentang tanggal (inklusif, mundur 1 utk jaga edge). */
function monthsCovering(range: DateRange): string[] {
  const months = new Set<string>();
  const push = (ymd: string) => months.add(ymd.slice(0, 7).replace('-', ''));
  push(range.start);
  push(range.end);
  // Rentang lintas batas bulan: tambah bulan tengah (jarang > 2, aman loop).
  let cursor = range.start;
  let guard = 0;
  while (cursor < range.end && guard < 400) {
    cursor = nextDay(cursor);
    push(cursor);
    guard += 1;
  }
  return [...months];
}
