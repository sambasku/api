import { describe, expect, it, vi } from 'vitest';

vi.mock('@/shared/logging/logger', () => ({ logger: { warn: vi.fn(), info: vi.fn(), error: vi.fn() } }));

import { GetMobileAnalyticsUseCase } from '../../application/use-cases/get-mobile-analytics.use-case';
import {
  MobileAnalyticsProviderError,
  type MobileAnalyticsProvider,
} from '../../application/ports/mobile-analytics.port';
import type { MobileOverview } from '../../domain/entities/mobile-analytics.entity';

const emptyOverview: MobileOverview = {
  totals: { active_users: 0, total_users: 0, new_users: 0, sessions: 0, event_count: 0, engagement_rate: 0 },
  previous: { active_users: 0, total_users: 0, new_users: 0, sessions: 0, event_count: 0, engagement_rate: 0 },
  trend: [],
  top_events: [],
  top_screens: [],
};

const okOverview: MobileOverview = { ...emptyOverview, totals: { ...emptyOverview.totals, event_count: 5, sessions: 2 } };

function makeProvider(overrides: Partial<MobileAnalyticsProvider> = {}): MobileAnalyticsProvider {
  return {
    isConfigured: () => true,
    getOverview: vi.fn().mockResolvedValue(okOverview),
    getEvents: vi.fn(),
    getScreens: vi.fn(),
    getAudience: vi.fn(),
    ...overrides,
  };
}

describe('GetMobileAnalyticsUseCase', () => {
  it('not_configured kalau provider belum siap', async () => {
    const useCase = new GetMobileAnalyticsUseCase({
      mobile: makeProvider({ isConfigured: () => false }),
      cacheTtlSeconds: 0,
    });
    const report = await useCase.execute({ section: 'overview', range: '28d' });
    expect(report.mobile.status).toBe('not_configured');
  });

  it('empty kalau totals event_count & sessions 0', async () => {
    const useCase = new GetMobileAnalyticsUseCase({
      mobile: makeProvider({ getOverview: vi.fn().mockResolvedValue(emptyOverview) }),
      cacheTtlSeconds: 0,
    });
    const report = await useCase.execute({ section: 'overview', range: '28d' });
    expect(report.mobile.status).toBe('empty');
  });

  it('ok kalau ada data', async () => {
    const useCase = new GetMobileAnalyticsUseCase({ mobile: makeProvider(), cacheTtlSeconds: 0 });
    const report = await useCase.execute({ section: 'overview', range: '28d' });
    expect(report.mobile.status).toBe('ok');
    expect(report.mobile.data).toEqual(okOverview);
  });

  it('error upstream dinormalisasi ke status error + kode MOBILE_UPSTREAM_ERROR', async () => {
    const useCase = new GetMobileAnalyticsUseCase({
      mobile: makeProvider({
        getOverview: vi.fn().mockRejectedValue(new MobileAnalyticsProviderError('upstream', 'boom')),
      }),
      cacheTtlSeconds: 0,
    });
    const report = await useCase.execute({ section: 'overview', range: '28d' });
    expect(report.mobile.status).toBe('error');
    expect(report.mobile.errorCode).toBe('MOBILE_UPSTREAM_ERROR');
  });
});
