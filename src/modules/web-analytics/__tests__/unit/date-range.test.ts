import { describe, expect, it } from 'vitest';
import { InvalidDateRangeError, resolveDateRange, shiftRangeToLatest } from '../../domain/date-range';

// 3 Okt 2026 10:00 WIB = 03:00 UTC → kemarin (WIB) = 2026-10-02
const NOW = new Date('2026-10-03T03:00:00Z');

describe('resolveDateRange', () => {
  it('preset 28d berakhir kemarin WIB, pembanding 28 hari tepat sebelumnya', () => {
    expect(resolveDateRange({ range: '28d' }, NOW)).toEqual({
      current: { start: '2026-09-05', end: '2026-10-02' },
      previous: { start: '2026-08-08', end: '2026-09-04' },
      days: 28,
    });
  });

  it('pakai tanggal WIB, bukan UTC (23:30 UTC sudah besok di WIB)', () => {
    const r = resolveDateRange({ range: '7d' }, new Date('2026-10-02T23:30:00Z'));
    expect(r.current.end).toBe('2026-10-02');
    expect(r.current.start).toBe('2026-09-26');
  });

  it('custom: pembanding sama panjang, lintas bulan', () => {
    const r = resolveDateRange({ range: 'custom', start: '2026-09-01', end: '2026-09-10' }, NOW);
    expect(r.days).toBe(10);
    expect(r.previous).toEqual({ start: '2026-08-22', end: '2026-08-31' });
  });

  it.each([
    [{ range: 'custom' as const, end: '2026-09-10' }, 'start'],
    [{ range: 'custom' as const, start: '2026-09-10', end: '2026-09-01' }, 'start'],
    [{ range: 'custom' as const, start: '2026-09-01', end: '2026-10-03' }, 'end'],
    [{ range: 'custom' as const, start: '2025-01-01', end: '2026-09-01' }, 'start'],
  ])('custom tidak valid → InvalidDateRangeError %#', (input, field) => {
    try {
      resolveDateRange(input, NOW);
      expect.unreachable();
    } catch (err) {
      expect(err).toBeInstanceOf(InvalidDateRangeError);
      expect((err as InvalidDateRangeError).field).toBe(field);
    }
  });
});

describe('shiftRangeToLatest', () => {
  it('geser current & previous dengan jarak yang sama', () => {
    const r = resolveDateRange({ range: '7d' }, NOW);
    const shifted = shiftRangeToLatest(r, '2026-09-30');
    expect(shifted.current).toEqual({ start: '2026-09-24', end: '2026-09-30' });
    expect(shifted.previous).toEqual({ start: '2026-09-17', end: '2026-09-23' });
    expect(shifted.days).toBe(7);
  });

  it('tidak menggeser kalau end sudah <= latest', () => {
    const r = resolveDateRange({ range: 'custom', start: '2026-09-01', end: '2026-09-10' }, NOW);
    expect(shiftRangeToLatest(r, '2026-09-30')).toBe(r);
  });
});
