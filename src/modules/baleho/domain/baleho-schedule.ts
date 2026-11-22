import { BALEHO_MAX_DAYS } from '@/shared/database/drizzle/schema/baleho.schema';

const WIB_OFFSET_MS = 7 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

/** 'YYYY-MM-DD' di zona WIB (konsisten searchDayWib). */
export function balehoDayWib(now: Date): string {
  return new Date(now.getTime() + WIB_OFFSET_MS).toISOString().slice(0, 10);
}

/** Parse tanggal kalender WIB → instant awal hari (00:00 WIB). */
export function parseBalehoStartsOn(isoDay: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(isoDay.trim());
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  if (!y || mo < 1 || mo > 12 || d < 1 || d > 31) return null;
  const utcMidnight = Date.UTC(y, mo - 1, d);
  return new Date(utcMidnight - WIB_OFFSET_MS);
}

export function formatBalehoStartsOn(dayStart: Date): string {
  return new Date(dayStart.getTime() + WIB_OFFSET_MS).toISOString().slice(0, 10);
}

/** Akhir hari terakhir jendela (inklusif): `starts_on` + (days - 1) hari, 23:59:59.999 WIB. */
export function computeEndsAtFromWindow(scheduledStart: Date, days: number): Date {
  const d = Math.min(Math.max(days, 1), BALEHO_MAX_DAYS);
  const lastDayStart = new Date(scheduledStart.getTime() + (d - 1) * DAY_MS);
  return new Date(lastDayStart.getTime() + DAY_MS - 1);
}

/** Dua interval waktu beririsan (inklusif batas). */
export function windowsOverlap(
  startA: Date,
  endA: Date,
  startB: Date,
  endB: Date,
): boolean {
  return startA.getTime() <= endB.getTime() && startB.getTime() <= endA.getTime();
}

export type BalehoRect = { col: number; row: number; w: number; h: number };

export function rectsOverlap(a: BalehoRect, b: BalehoRect): boolean {
  return (
    a.col < b.col + b.w &&
    a.col + a.w > b.col &&
    a.row < b.row + b.h &&
    a.row + a.h > b.row
  );
}

/** Awal jendela booking/tayang untuk cek bentrok (legacy tanpa scheduled → createdAt). */
export function placementBookingWindowStart(row: {
  scheduledStartsOn: Date | null;
  startsAt: Date | null;
  createdAt: Date;
}): Date {
  return row.scheduledStartsOn ?? row.startsAt ?? row.createdAt;
}

export function resolveBalehoLiveWindow(args: {
  scheduledStart: Date;
  days: number;
  paidAt: Date;
}): { startsAt: Date; endsAt: Date } {
  const endsAt = computeEndsAtFromWindow(args.scheduledStart, args.days);
  const scheduledMs = args.scheduledStart.getTime();
  const paidMs = args.paidAt.getTime();
  const startsAt = paidMs >= scheduledMs ? args.paidAt : args.scheduledStart;
  return { startsAt, endsAt };
}

/** Nomor WA konfirmasi: digit internasional tanpa +; hanya Indonesia (62) atau Malaysia (60). */
export function normalizeBalehoConfirmationPhone(
  raw: string,
): string | '__INVALID__' {
  const digits = raw.replace(/\D/g, '');
  if (/^62\d{8,13}$/.test(digits)) return digits;
  if (/^60\d{9,12}$/.test(digits)) return digits;
  return '__INVALID__';
}