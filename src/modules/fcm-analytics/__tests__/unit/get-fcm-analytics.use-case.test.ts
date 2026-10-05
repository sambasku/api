import { describe, expect, it, vi } from 'vitest';

vi.mock('@/shared/logging/logger', () => ({ logger: { warn: vi.fn(), info: vi.fn(), error: vi.fn() } }));

import { GetFcmAnalyticsUseCase } from '../../application/use-cases/get-fcm-analytics.use-case';
import { AnalyticsProviderError, type FcmAnalyticsProvider } from '../../application/ports/fcm-analytics.port';
import type { FcmDelivery, FcmEngagement } from '../../domain/entities/fcm-analytics.entity';

const NOW = new Date('2026-10-03T10:00:00+07:00');

const DELIVERY: FcmDelivery = {
  totals: { sent: 200, delivered: 188, failed: 12, opened: 42, openRate: 0.223 },
  previous: { sent: 150, delivered: 140, failed: 10, opened: 30, openRate: 0.214 },
  trend: [{ date: '2026-10-01', sent: 32, delivered: 30, opened: 7 }],
  latestDataDate: '2026-10-02',
};

const ENGAGEMENT: FcmEngagement = { ...DELIVERY, avgEngagementSeconds: 17 };

function fakeProvider(overrides: Partial<FcmAnalyticsProvider> = {}): FcmAnalyticsProvider {
  return {
    isConfigured: () => true,
    getDelivery: async () => DELIVERY,
    getEngagement: async () => ENGAGEMENT,
    ...overrides,
  };
}

function throwErr(err: unknown): never {
  throw err;
}

describe('GetFcmAnalyticsUseCase', () => {
  it('section delivery -> status ok + data terisi', async () => {
    const uc = new GetFcmAnalyticsUseCase({ fcm: fakeProvider(), cacheTtlSeconds: 0, now: () => NOW });
    const report = await uc.execute({ section: 'delivery', range: '7d' });
    expect(report.fcm.status).toBe('ok');
    expect(report.section).toBe('delivery');
    expect(report.range.days).toBe(7);
  });

  it('section engagement -> status ok', async () => {
    const uc = new GetFcmAnalyticsUseCase({ fcm: fakeProvider(), cacheTtlSeconds: 0, now: () => NOW });
    const report = await uc.execute({ section: 'engagement', range: '7d' });
    expect(report.fcm.status).toBe('ok');
  });

  it('tanpa konfigurasi -> not_configured', async () => {
    const uc = new GetFcmAnalyticsUseCase({
      fcm: fakeProvider({ isConfigured: () => false }),
      cacheTtlSeconds: 0,
      now: () => NOW,
    });
    const report = await uc.execute({ section: 'delivery', range: '7d' });
    expect(report.fcm.status).toBe('not_configured');
    expect(report.fcm.errorCode).toBe('FCM_NOT_CONFIGURED');
  });

  it('provider error -> status error di dalam 200 (bukan throw)', async () => {
    const fcm = fakeProvider({
      getDelivery: () => throwErr(new AnalyticsProviderError('permission_denied', '403')),
    });
    const uc = new GetFcmAnalyticsUseCase({ fcm, cacheTtlSeconds: 0, now: () => NOW });
    const report = await uc.execute({ section: 'delivery', range: '7d' });
    expect(report.fcm.status).toBe('error');
    expect(report.fcm.errorCode).toBe('FCM_PERMISSION_DENIED');
  });

  it('cache: panggilan kedua tidak memanggil provider lagi', async () => {
    let calls = 0;
    const fcm = fakeProvider({
      getDelivery: async () => {
        calls += 1;
        return DELIVERY;
      },
    });
    const uc = new GetFcmAnalyticsUseCase({ fcm, cacheTtlSeconds: 600, now: () => NOW });
    await uc.execute({ section: 'delivery', range: '7d' });
    await uc.execute({ section: 'delivery', range: '7d' });
    expect(calls).toBe(1);
  });

  it('rentang custom invalid -> ValidationError', async () => {
    const uc = new GetFcmAnalyticsUseCase({ fcm: fakeProvider(), cacheTtlSeconds: 0, now: () => NOW });
    await expect(
      uc.execute({ section: 'delivery', range: 'custom', start: '2026-10-02', end: '2026-10-01' }),
    ).rejects.toMatchObject({ details: [{ field: 'start' }] });
  });
});
