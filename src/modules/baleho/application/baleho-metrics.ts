/** Agregat event + turunan performa Baleho (pemesan & publisher). */

export type BalehoEventCounts = {
  impressions: number;
  taps: number;
  actions: number;
  actionSuccess: number;
  actionFail: number;
};

export type BalehoDailyBucket = {
  date: string;
  impressions: number;
  taps: number;
  actions: number;
};

export type BalehoPerfWire = {
  impressions: number;
  taps: number;
  actions: number;
  action_success: number;
  action_fail: number;
  ctr_percent: number;
  action_rate_percent: number;
  success_rate_percent: number;
  quoted_amount: number | null;
  /** Biaya per 1000 tayang (IDR), null jika belum ada quote/impresi. */
  cpm_idr: number | null;
  /** Biaya per tap detail (IDR), null jika belum ada quote/tap. */
  cpc_idr: number | null;
  /** Tren harian WIB, urut naik (terlama → terbaru). */
  daily: BalehoDailyBucket[];
};

/** 1 desimal, sama pola CTR lama. */
export function roundRatePercent(n: number): number {
  return Math.round(n * 10) / 10;
}

export function emptyEventCounts(): BalehoEventCounts {
  return {
    impressions: 0,
    taps: 0,
    actions: 0,
    actionSuccess: 0,
    actionFail: 0,
  };
}

/**
 * Turunan funnel + efisiensi biaya dari agregat lifetime + quote snapshot.
 */
export function deriveBalehoPerfMetrics(args: {
  counts: BalehoEventCounts;
  quotedAmount: number | null;
  daily?: BalehoDailyBucket[];
}): BalehoPerfWire {
  const {
    impressions,
    taps,
    actions,
    actionSuccess,
    actionFail,
  } = args.counts;
  const quoted =
    args.quotedAmount != null && Number.isFinite(args.quotedAmount)
      ? Math.round(args.quotedAmount)
      : null;

  return {
    impressions,
    taps,
    actions,
    action_success: actionSuccess,
    action_fail: actionFail,
    ctr_percent:
      impressions > 0 ? roundRatePercent((taps / impressions) * 100) : 0,
    action_rate_percent:
      taps > 0 ? roundRatePercent((actions / taps) * 100) : 0,
    success_rate_percent:
      actions > 0 ? roundRatePercent((actionSuccess / actions) * 100) : 0,
    quoted_amount: quoted,
    cpm_idr:
      quoted != null && impressions > 0
        ? Math.round((quoted / impressions) * 1000)
        : null,
    cpc_idr: quoted != null && taps > 0 ? Math.round(quoted / taps) : null,
    daily: args.daily ?? [],
  };
}

/** YYYY-MM-DD kalender WIB dari Instant UTC. */
export function wibDateString(now: Date): string {
  const shifted = new Date(now.getTime() + 7 * 60 * 60 * 1000);
  return shifted.toISOString().slice(0, 10);
}

export function shiftCalendarDate(ymd: string, deltaDays: number): string {
  const [y, m, d] = ymd.split('-').map(Number);
  const utc = Date.UTC(y, m - 1, d + deltaDays);
  return new Date(utc).toISOString().slice(0, 10);
}

/** Tengah malam WIB (UTC) untuk batas bawah window harian. */
export function startOfWibDayUtc(ymd: string): Date {
  const [y, m, d] = ymd.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d, -7, 0, 0, 0));
}

/**
 * Isi deret `days` hari (WIB) sampai `todayYmd`, nol bila kosong.
 * Input `raw` boleh acak; output urut naik.
 */
export function fillDailySeries(args: {
  todayYmd: string;
  days: number;
  raw: Array<{
    date: string;
    impressions: number;
    taps: number;
    actions: number;
  }>;
}): BalehoDailyBucket[] {
  const byDate = new Map(args.raw.map((r) => [r.date, r]));
  const out: BalehoDailyBucket[] = [];
  const startOffset = -(args.days - 1);
  for (let i = startOffset; i <= 0; i++) {
    const date = shiftCalendarDate(args.todayYmd, i);
    const hit = byDate.get(date);
    out.push({
      date,
      impressions: hit?.impressions ?? 0,
      taps: hit?.taps ?? 0,
      actions: hit?.actions ?? 0,
    });
  }
  return out;
}
