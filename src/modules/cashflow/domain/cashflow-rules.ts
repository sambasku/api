/**
 * Aturan murni cashflow (tanpa DB). Dipakai service dan test unit.
 * Semua nominal integer rupiah. Tanggal ISO YYYY-MM-DD, periode YYYY-MM.
 */

export type KewajibanRecurrence = 'sekali' | 'bulanan' | 'tahunan';
export type PeriodeStatus = 'belum' | 'sebagian' | 'lunas';

/** Kode master untuk kategori yang wajib mengisi penerima (jasa freelance dan reward). */
export const KODE_KATEGORI_JASA = 'KLR-JSA';

const PERIODE_RE = /^\d{4}-(0[1-9]|1[0-2])$/;
const ISO_DATE_RE = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;

export function isPeriode(value: string): boolean {
  return PERIODE_RE.test(value);
}

export function isIsoDate(value: string): boolean {
  return ISO_DATE_RE.test(value);
}

export function periodeFromDate(isoDate: string): string {
  return isoDate.slice(0, 7);
}

/** Tambah n bulan ke periode YYYY-MM. */
export function addMonthsToPeriode(periode: string, n: number): string {
  const [y, m] = periode.split('-').map(Number);
  const total = y * 12 + (m - 1) + n;
  const year = Math.floor(total / 12);
  const month = (total % 12) + 1;
  return `${year}-${String(month).padStart(2, '0')}`;
}

/** Selisih bulan periode a ke b (b - a). */
export function monthsBetween(a: string, b: string): number {
  const [ay, am] = a.split('-').map(Number);
  const [by, bm] = b.split('-').map(Number);
  return (by - ay) * 12 + (bm - am);
}

function stepMonths(recurrence: KewajibanRecurrence): number {
  if (recurrence === 'bulanan') return 1;
  if (recurrence === 'tahunan') return 12;
  return 0;
}

export interface KewajibanSchedule {
  recurrence: KewajibanRecurrence;
  periodeMulai: string;
  /** ISO date. Periode setelah bulan tanggal ini tidak dibuat. Null = tanpa batas. */
  berhentiPer: string | null;
}

/**
 * Daftar periode kewajiban sampai `untilPeriode` (inklusif).
 * - sekali: hanya periodeMulai
 * - bulanan: setiap bulan
 * - tahunan: setiap 12 bulan, bulannya mengikuti periodeMulai
 * Periode berhenti setelah bulan `berhentiPer` (periode di bulan itu masih dibuat).
 */
export function generatePeriodes(schedule: KewajibanSchedule, untilPeriode: string): string[] {
  const step = stepMonths(schedule.recurrence);
  const limit = schedule.berhentiPer
    ? minPeriode(untilPeriode, periodeFromDate(schedule.berhentiPer))
    : untilPeriode;
  if (monthsBetween(schedule.periodeMulai, limit) < 0) return [];
  if (step === 0) return [schedule.periodeMulai];

  const out: string[] = [];
  for (let k = 0; ; k++) {
    const p = addMonthsToPeriode(schedule.periodeMulai, k * step);
    if (monthsBetween(p, limit) < 0) break;
    out.push(p);
  }
  return out;
}

function minPeriode(a: string, b: string): string {
  return monthsBetween(a, b) >= 0 ? a : b;
}

export function isPeriodeInSchedule(schedule: KewajibanSchedule, periode: string): boolean {
  if (!isPeriode(periode)) return false;
  return generatePeriodes(schedule, periode).includes(periode);
}

/** Tanggal jatuh tempo: hari dalam bulan, dibulatkan ke akhir bulan jika bulan lebih pendek. */
export function dueDate(periode: string, hariJatuhTempo: number): string {
  const [y, m] = periode.split('-').map(Number);
  const lastDay = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const day = Math.min(hariJatuhTempo, lastDay);
  return `${periode}-${String(day).padStart(2, '0')}`;
}

export function periodeStatus(paid: number, nominalEstimasi: number): PeriodeStatus {
  if (paid >= nominalEstimasi) return 'lunas';
  if (paid > 0) return 'sebagian';
  return 'belum';
}

/**
 * Periode berikutnya setelah periode lunas terakhir.
 * Jika belum ada yang lunas, periode pertama (periodeMulai).
 * `periodes` harus urut naik. `lunasSet` berisi periode yang sudah lunas.
 */
export function nextPeriodeAfterLunas(periodes: string[], lunasSet: Set<string>): string | null {
  let lastIdx = -1;
  periodes.forEach((p, i) => {
    if (lunasSet.has(p)) lastIdx = i;
  });
  const nextIdx = lastIdx + 1;
  return nextIdx < periodes.length ? periodes[nextIdx] : null;
}

export function isOverdue(dueIsoDate: string, today: string, status: PeriodeStatus): boolean {
  return status !== 'lunas' && dueIsoDate < today;
}

/** Tanggal hari ini di zona Asia/Jakarta, format YYYY-MM-DD. */
export function todayJakarta(now: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Jakarta',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
}

/** Sisa pokok talangan (tidak negatif). */
export function sisaPokok(pokok: number, reimbursed: number): number {
  return Math.max(0, pokok - reimbursed);
}
