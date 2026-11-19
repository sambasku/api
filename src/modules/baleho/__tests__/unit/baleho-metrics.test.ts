import { describe, expect, it } from 'vitest';
import {
  deriveBalehoPerfMetrics,
  fillDailySeries,
  roundRatePercent,
  shiftCalendarDate,
  wibDateString,
} from '../../application/baleho-metrics';

describe('baleho-metrics', () => {
  it('roundRatePercent 1 desimal', () => {
    expect(roundRatePercent(12.34)).toBe(12.3);
    expect(roundRatePercent(12.35)).toBe(12.4);
  });

  it('derive funnel + CPM/CPC', () => {
    const perf = deriveBalehoPerfMetrics({
      counts: {
        impressions: 1000,
        taps: 50,
        actions: 10,
        actionSuccess: 8,
        actionFail: 2,
      },
      quotedAmount: 210_000,
      daily: [{ date: '2026-11-20', impressions: 10, taps: 1, actions: 0 }],
    });
    expect(perf.ctr_percent).toBe(5);
    expect(perf.action_rate_percent).toBe(20);
    expect(perf.success_rate_percent).toBe(80);
    expect(perf.cpm_idr).toBe(210_000); // 210000/1000*1000
    expect(perf.cpc_idr).toBe(4200); // 210000/50
    expect(perf.quoted_amount).toBe(210_000);
    expect(perf.daily).toHaveLength(1);
  });

  it('null biaya bila belum ada quote atau denominator 0', () => {
    const a = deriveBalehoPerfMetrics({
      counts: {
        impressions: 0,
        taps: 0,
        actions: 0,
        actionSuccess: 0,
        actionFail: 0,
      },
      quotedAmount: 10_000,
    });
    expect(a.cpm_idr).toBeNull();
    expect(a.cpc_idr).toBeNull();
    expect(a.ctr_percent).toBe(0);

    const b = deriveBalehoPerfMetrics({
      counts: {
        impressions: 10,
        taps: 2,
        actions: 1,
        actionSuccess: 1,
        actionFail: 0,
      },
      quotedAmount: null,
    });
    expect(b.cpm_idr).toBeNull();
    expect(b.cpc_idr).toBeNull();
  });

  it('fillDailySeries isi nol untuk hari kosong', () => {
    const today = '2026-11-20';
    const series = fillDailySeries({
      todayYmd: today,
      days: 3,
      raw: [{ date: '2026-11-20', impressions: 5, taps: 1, actions: 0 }],
    });
    expect(series.map((d) => d.date)).toEqual([
      '2026-11-18',
      '2026-11-19',
      '2026-11-20',
    ]);
    expect(series[0]).toEqual({
      date: '2026-11-18',
      impressions: 0,
      taps: 0,
      actions: 0,
    });
    expect(series[2].impressions).toBe(5);
  });

  it('wibDateString / shiftCalendarDate', () => {
    // 2026-11-19 20:00 UTC = 2026-11-20 03:00 WIB
    expect(wibDateString(new Date('2026-11-19T20:00:00.000Z'))).toBe(
      '2026-11-20',
    );
    expect(shiftCalendarDate('2026-11-01', -1)).toBe('2026-10-31');
  });
});
