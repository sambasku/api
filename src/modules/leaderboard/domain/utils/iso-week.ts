/**
 * Matematika minggu ISO-8601 di zona WIB (UTC+7, tanpa DST).
 * week_id: `YYYY-"W"ww` contoh `2026-W40`.
 * Window: Senin 00:00:00 WIB sampai Senin berikutnya 00:00:00 WIB (eksklusif).
 */

export const WIB_OFFSET_MS = 7 * 60 * 60 * 1000;

export const TOP_N = 30;
export const REFRESH_INTERVAL_MS = 6 * 60 * 60 * 1000;
/** Skor papan peringkat mingguan (plan peringkat mingguan skor poin usul + bonus). */
export const LEADERBOARD_CREATE_SUBMIT_POINTS = 5;
export const LEADERBOARD_EDIT_SUBMIT_POINTS = 3;
export const LEADERBOARD_APPROVE_POINTS = 2;
export const LEADERBOARD_VERIFICATION_POINTS = 2;

/** Instant UTC → komponen kalender WIB. */
export function wibParts(date: Date): {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
} {
  const shifted = new Date(date.getTime() + WIB_OFFSET_MS);
  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth() + 1,
    day: shifted.getUTCDate(),
    hour: shifted.getUTCHours(),
    minute: shifted.getUTCMinutes(),
    second: shifted.getUTCSeconds(),
  };
}

/** Bangun Date UTC dari jam kalender WIB. */
export function dateFromWib(
  year: number,
  month: number,
  day: number,
  hour = 0,
  minute = 0,
  second = 0,
): Date {
  return new Date(Date.UTC(year, month - 1, day, hour, minute, second) - WIB_OFFSET_MS);
}

/** Senin 00:00 WIB yang memuat `date` (atau sama jika `date` sudah Senin 00:00). */
export function startOfIsoWeekWib(date: Date): Date {
  const p = wibParts(date);
  const asUtcNoon = Date.UTC(p.year, p.month - 1, p.day, 12, 0, 0);
  // diganti ke Senin: getUTCDay 0=Minggu … 1=Senin
  const dow = new Date(asUtcNoon).getUTCDay();
  const daysFromMonday = dow === 0 ? 6 : dow - 1;
  return dateFromWib(p.year, p.month, p.day - daysFromMonday, 0, 0, 0);
}

export function endOfIsoWeekWib(date: Date): Date {
  const start = startOfIsoWeekWib(date);
  return new Date(start.getTime() + 7 * 24 * 60 * 60 * 1000);
}

/**
 * Nomor minggu ISO: minggu mengandung Kamis; week 1 = minggu berisi 4 Jan.
 * Hitung dari Senin WIB.
 */
export function isoWeekNumber(date: Date): { year: number; week: number } {
  const monday = startOfIsoWeekWib(date);
  const mp = wibParts(monday);
  // Kamis minggu ini (Senin+3) menentukan tahun ISO
  const thursday = dateFromWib(mp.year, mp.month, mp.day + 3, 12, 0, 0);
  const tp = wibParts(thursday);
  const isoYear = tp.year;
  const jan4 = dateFromWib(isoYear, 1, 4, 12, 0, 0);
  const week1Monday = startOfIsoWeekWib(jan4);
  const diffDays = Math.round(
    (monday.getTime() - week1Monday.getTime()) / (24 * 60 * 60 * 1000),
  );
  const week = Math.floor(diffDays / 7) + 1;
  return { year: isoYear, week };
}

export function weekId(date: Date): string {
  const { year, week } = isoWeekNumber(date);
  return `${year}-W${String(week).padStart(2, '0')}`;
}

export function parseWeekId(id: string): { year: number; week: number } {
  const m = /^(\d{4})-W(\d{2})$/.exec(id.trim());
  if (!m) throw new Error(`week_id tidak valid: ${id}`);
  const year = Number(m[1]);
  const week = Number(m[2]);
  if (week < 1 || week > 53) throw new Error(`week_id tidak valid: ${id}`);
  return { year, week };
}

/** Window [startedAt, endedAt) untuk week_id. */
export function windowForWeekId(id: string): { startedAt: Date; endedAt: Date } {
  const { year, week } = parseWeekId(id);
  const jan4 = dateFromWib(year, 1, 4, 12, 0, 0);
  const week1Monday = startOfIsoWeekWib(jan4);
  const startedAt = new Date(week1Monday.getTime() + (week - 1) * 7 * 24 * 60 * 60 * 1000);
  const endedAt = new Date(startedAt.getTime() + 7 * 24 * 60 * 60 * 1000);
  return { startedAt, endedAt };
}

export function currentWeekWindow(now = new Date()): {
  weekId: string;
  startedAt: Date;
  endedAt: Date;
} {
  const startedAt = startOfIsoWeekWib(now);
  const endedAt = endOfIsoWeekWib(now);
  return { weekId: weekId(now), startedAt, endedAt };
}

/** Format ISO offset +07:00 untuk wire JSON. */
export function formatWibOffset(date: Date): string {
  const p = wibParts(date);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${p.year}-${pad(p.month)}-${pad(p.day)}T${pad(p.hour)}:${pad(p.minute)}:${pad(p.second)}+07:00`;
}
