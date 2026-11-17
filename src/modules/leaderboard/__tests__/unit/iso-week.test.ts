import { describe, expect, it } from 'vitest';
import {
  dateFromWib,
  isoWeekNumber,
  parseWeekId,
  weekId,
  windowForWeekId,
  wibParts,
} from '../../domain/utils/iso-week';

describe('iso-week utils', () => {
  it('weekId round-trip dengan parseWeekId', () => {
    const d = dateFromWib(2026, 10, 1, 12, 0, 0);
    const id = weekId(d);
    expect(parseWeekId(id)).toEqual(isoWeekNumber(d));
  });

  it('windowForWeekId selalu 7 hari [start, end)', () => {
    const id = '2026-W40';
    const { startedAt, endedAt } = windowForWeekId(id);
    expect(endedAt.getTime() - startedAt.getTime()).toBe(7 * 24 * 60 * 60 * 1000);
    const sp = wibParts(startedAt);
    expect(sp.hour).toBe(0);
    expect(sp.minute).toBe(0);
    expect(sp.second).toBe(0);
    const noon = dateFromWib(sp.year, sp.month, sp.day, 12, 0, 0);
    const dowWib = new Date(noon.getTime() + 7 * 60 * 60 * 1000).getUTCDay();
    expect(dowWib).toBe(1);
  });

  it('tahun baru 2026-01-01 masuk minggu ISO tahun sebelumnya atau tahun baru konsisten', () => {
    const newYear = dateFromWib(2026, 1, 1, 0, 0, 0);
    const id = weekId(newYear);
    expect(id).toMatch(/^202\d-W\d{2}$/);
    const { year, week } = parseWeekId(id);
    expect(year).toBeGreaterThanOrEqual(2025);
    expect(week).toBeGreaterThanOrEqual(1);
    const { startedAt, endedAt } = windowForWeekId(id);
    expect(newYear.getTime()).toBeGreaterThanOrEqual(startedAt.getTime());
    expect(newYear.getTime()).toBeLessThan(endedAt.getTime());
  });
});