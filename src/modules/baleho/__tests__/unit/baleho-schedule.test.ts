import { describe, expect, it } from 'vitest';
import {
  balehoDayWib,
  computeEndsAtFromWindow,
  parseBalehoStartsOn,
  rectsOverlap,
  resolveBalehoLiveWindow,
  windowsOverlap,
} from '../../domain/baleho-schedule';

describe('baleho-schedule', () => {
  it('parseBalehoStartsOn → awal hari WIB', () => {
    const start = parseBalehoStartsOn('2026-11-22');
    expect(start).not.toBeNull();
    expect(formatSlice(start!)).toBe('2026-11-22');
  });

  it('computeEndsAtFromWindow 30 hari inklusif', () => {
    const start = parseBalehoStartsOn('2026-11-22')!;
    const endsAt = computeEndsAtFromWindow(start, 30);
    const lastDay = new Date(start.getTime() + 29 * 86400000);
    expect(formatSlice(endsAt)).toBe(formatSlice(lastDay));
    expect(endsAt.getTime()).toBeGreaterThan(lastDay.getTime());
  });

  it('mark-paid sebelum jadwal → startsAt = scheduled', () => {
    const scheduled = parseBalehoStartsOn('2026-12-01')!;
    const paidAt = new Date('2026-11-22T10:00:00.000Z');
    const { startsAt, endsAt } = resolveBalehoLiveWindow({
      scheduledStart: scheduled,
      days: 7,
      paidAt,
    });
    expect(startsAt.getTime()).toBe(scheduled.getTime());
    expect(endsAt.getTime()).toBe(computeEndsAtFromWindow(scheduled, 7).getTime());
  });

  it('mark-paid setelah jadwal → startsAt = paidAt', () => {
    const scheduled = parseBalehoStartsOn('2026-11-20')!;
    const paidAt = new Date('2026-11-22T10:00:00.000Z');
    const { startsAt } = resolveBalehoLiveWindow({
      scheduledStart: scheduled,
      days: 7,
      paidAt,
    });
    expect(startsAt.getTime()).toBe(paidAt.getTime());
  });

  it('windowsOverlap tanggal bersebelahan tidak bentrok', () => {
    const aStart = parseBalehoStartsOn('2026-12-01')!;
    const aEnd = computeEndsAtFromWindow(aStart, 7);
    const bStart = parseBalehoStartsOn('2026-12-08')!;
    const bEnd = computeEndsAtFromWindow(bStart, 7);
    expect(windowsOverlap(aStart, aEnd, bStart, bEnd)).toBe(false);
    expect(
      windowsOverlap(aStart, aEnd, parseBalehoStartsOn('2026-12-05')!, aEnd),
    ).toBe(true);
  });

  it('rectsOverlap grid', () => {
    expect(
      rectsOverlap(
        { col: 0, row: 0, w: 1, h: 1 },
        { col: 1, row: 0, w: 1, h: 1 },
      ),
    ).toBe(false);
    expect(
      rectsOverlap(
        { col: 0, row: 0, w: 2, h: 1 },
        { col: 1, row: 0, w: 1, h: 1 },
      ),
    ).toBe(true);
  });

  it('balehoDayWib', () => {
    const noon = new Date('2026-11-21T18:00:00.000Z');
    expect(balehoDayWib(noon)).toBe('2026-11-22');
  });
});

function formatSlice(d: Date): string {
  return new Date(d.getTime() + 7 * 60 * 60 * 1000).toISOString().slice(0, 10);
}