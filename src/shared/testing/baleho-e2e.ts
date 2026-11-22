import {
  balehoDayWib,
  formatBalehoStartsOn,
  parseBalehoStartsOn,
} from '@/modules/baleho/domain/baleho-schedule';

const DAY_MS = 24 * 60 * 60 * 1000;

/** Tanggal mulai booking valid untuk e2e / unit (besok WIB, tidak di masa lalu). */
export function e2eBalehoStartsOn(from: Date = new Date()): string {
  const today = parseBalehoStartsOn(balehoDayWib(from));
  if (!today) return balehoDayWib(from);
  return formatBalehoStartsOn(new Date(today.getTime() + DAY_MS));
}