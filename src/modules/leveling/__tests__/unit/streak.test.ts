import { describe, expect, it } from 'vitest';
import {
  computeStreakDays,
  prevDateKey,
  wibDateKey,
} from '../../domain/streak';

describe('wibDateKey / prevDateKey', () => {
  it('WIB dari UTC malam = tanggal lokal', () => {
    // 2026-10-27 20:00 UTC = 2026-10-28 03:00 WIB
    expect(wibDateKey(Date.UTC(2026, 9, 27, 20, 0, 0))).toBe('2026-10-28');
  });

  it('prevDateKey mundur satu hari', () => {
    expect(prevDateKey('2026-10-28')).toBe('2026-10-27');
    expect(prevDateKey('2026-03-01')).toBe('2026-02-28');
  });
});

describe('computeStreakDays', () => {
  it('hari dobel dihitung sekali', () => {
    const days = new Set(['2026-10-28', '2026-10-27']);
    expect(computeStreakDays(days, '2026-10-28')).toBe(2);
  });

  it('grace 1 hari: bolong kemarin masih lanjut jika hari ini aktif', () => {
    // aktif: 28, 26 — bolong 27 dipakai grace
    const days = new Set(['2026-10-28', '2026-10-26']);
    expect(computeStreakDays(days, '2026-10-28')).toBe(2);
  });

  it('dua hari bolong berurutan memutus', () => {
    // aktif 28 dan 25 — bolong 27 (grace) lalu 26 (putus) sebelum 25
    const days = new Set(['2026-10-28', '2026-10-25']);
    expect(computeStreakDays(days, '2026-10-28')).toBe(1);
  });

  it('10 hari aktif bolong-bolong ≠ streak 10', () => {
    const days = new Set([
      '2026-10-28',
      '2026-10-26',
      '2026-10-24',
      '2026-10-22',
      '2026-10-20',
      '2026-10-18',
      '2026-10-16',
      '2026-10-14',
      '2026-10-12',
      '2026-10-10',
    ]);
    // 28 aktif, 27 grace, 26 aktif, 25 grace habis di pola? 
    // 28 yes, 27 empty grace, 26 yes reset grace, 25 empty grace, 24 yes...
    // Actually with alternating, each gap uses grace and resets when hit active
    // So: 28, grace27, 26, grace25, 24, grace23, 22... all 10 actives count
    expect(computeStreakDays(days, '2026-10-28')).toBe(10);
  });

  it('hari ini kosong + kemarin aktif: grace menutup hari ini', () => {
    const days = new Set(['2026-10-27', '2026-10-26']);
    expect(computeStreakDays(days, '2026-10-28')).toBe(2);
  });

  it('kosong total = 0', () => {
    expect(computeStreakDays(new Set(), '2026-10-28')).toBe(0);
  });
});
