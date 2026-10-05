/**
 * Test mapping respons FCM Data API -> trend/totals. Endpoint asli tidak
 * dipanggil; mapping diekstrak agar bisa diuji tanpa network.
 */
import { describe, expect, it } from 'vitest';
import { totalsFromTrend } from '../../infrastructure/fcm-analytics.provider';

describe('totalsFromTrend', () => {
  it('jumlah sent/delivered/opened + failed = sent - delivered', () => {
    const trend = [
      { date: '2026-10-01', sent: 30, delivered: 28, opened: 6 },
      { date: '2026-10-02', sent: 20, delivered: 20, opened: 5 },
    ];
    expect(totalsFromTrend(trend)).toEqual({
      sent: 50,
      delivered: 48,
      failed: 2,
      opened: 11,
      openRate: 11 / 48,
    });
  });

  it('delivered 0 -> openRate 0, bukan NaN', () => {
    expect(totalsFromTrend([{ date: '2026-10-01', sent: 0, delivered: 0, opened: 0 }])).toEqual({
      sent: 0,
      delivered: 0,
      failed: 0,
      opened: 0,
      openRate: 0,
    });
  });
});
