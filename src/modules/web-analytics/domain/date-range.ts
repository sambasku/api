import type { DateRange, ResolvedRange } from './entities/web-analytics.entity';

export const RANGE_PRESETS = ['7d', '28d', '90d', 'custom'] as const;
export type RangePreset = (typeof RANGE_PRESETS)[number];

export const MAX_CUSTOM_DAYS = 366;
const DAY_MS = 86_400_000;
const WIB_OFFSET_MS = 7 * 3_600_000;

export class InvalidDateRangeError extends Error {
  constructor(
    readonly field: 'start' | 'end',
    message: string,
  ) {
    super(message);
  }
}

function toUtcMs(ymd: string): number {
  return Date.parse(`${ymd}T00:00:00Z`);
}

export function ymdFromMs(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

export function addDays(ymd: string, days: number): string {
  return ymdFromMs(toUtcMs(ymd) + days * DAY_MS);
}

export function daysBetweenInclusive(range: DateRange): number {
  return Math.round((toUtcMs(range.end) - toUtcMs(range.start)) / DAY_MS) + 1;
}

/** Tanggal hari ini di WIB (zona property GA4 SambasKu). */
export function todayWib(now: Date): string {
  return ymdFromMs(now.getTime() + WIB_OFFSET_MS);
}

/**
 * Preset = N hari lengkap yang berakhir kemarin (hari ini belum selesai,
 * angkanya selalu turun kalau dibandingkan). Pembanding = N hari tepat
 * sebelum `start`.
 */
export function resolveDateRange(
  input: { range: RangePreset; start?: string; end?: string },
  now: Date = new Date(),
): ResolvedRange {
  const yesterday = addDays(todayWib(now), -1);
  let current: DateRange;
  if (input.range === 'custom') {
    if (!input.start) throw new InvalidDateRangeError('start', 'Tanggal mulai wajib diisi untuk rentang custom');
    if (!input.end) throw new InvalidDateRangeError('end', 'Tanggal akhir wajib diisi untuk rentang custom');
    if (Number.isNaN(toUtcMs(input.start))) throw new InvalidDateRangeError('start', 'Tanggal mulai tidak valid');
    if (Number.isNaN(toUtcMs(input.end))) throw new InvalidDateRangeError('end', 'Tanggal akhir tidak valid');
    if (input.start > input.end) {
      throw new InvalidDateRangeError('start', 'Tanggal mulai harus sebelum tanggal akhir');
    }
    if (input.end > yesterday) {
      throw new InvalidDateRangeError('end', 'Tanggal akhir paling lambat kemarin');
    }
    current = { start: input.start, end: input.end };
    if (daysBetweenInclusive(current) > MAX_CUSTOM_DAYS) {
      throw new InvalidDateRangeError('start', `Rentang maksimal ${MAX_CUSTOM_DAYS} hari`);
    }
  } else {
    const days = Number.parseInt(input.range, 10);
    current = { start: addDays(yesterday, -(days - 1)), end: yesterday };
  }
  const days = daysBetweenInclusive(current);
  const previousEnd = addDays(current.start, -1);
  return { current, previous: { start: addDays(previousEnd, -(days - 1)), end: previousEnd }, days };
}

/**
 * Geser rentang mundur supaya `end` tidak melewati `latest` (data Search
 * Console baru final 2-3 hari kemudian). Panjang & pembanding tetap.
 */
export function shiftRangeToLatest(range: ResolvedRange, latest: string): ResolvedRange {
  if (range.current.end <= latest) return range;
  const shift = -Math.round((toUtcMs(range.current.end) - toUtcMs(latest)) / DAY_MS);
  const move = (r: DateRange): DateRange => ({ start: addDays(r.start, shift), end: addDays(r.end, shift) });
  return { current: move(range.current), previous: move(range.previous), days: range.days };
}
