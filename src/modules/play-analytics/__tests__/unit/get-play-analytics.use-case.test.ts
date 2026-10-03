import { describe, expect, it, vi } from 'vitest';

vi.mock('@/shared/logging/logger', () => ({ logger: { warn: vi.fn(), info: vi.fn(), error: vi.fn() } }));

import { GetPlayAnalyticsUseCase } from '../../application/use-cases/get-play-analytics.use-case';
import { AnalyticsProviderError, type PlayStatsProvider } from '../../application/ports/play-analytics.port';
import type { PlayOverview } from '../../domain/entities/play-analytics.entity';

const NOW = new Date('2026-10-03T10:00:00+07:00');

const OVERVIEW: PlayOverview = {
  totals: { newInstalls: 45, activeInstalls: 4221, uninstalls: 7, updates: 16, averageRating: 4.36, ratingCount: 140 },
  previous: { newInstalls: 30, activeInstalls: 4170, uninstalls: 5, updates: 10, averageRating: 4.3, ratingCount: 120 },
  trend: [{ date: '2026-10-01', installs: 20, uninstalls: 3 }],
  topCountries: [{ country: 'ID', installs: 40 }],
};

function fakeProvider(overrides: Partial<PlayStatsProvider> = {}): PlayStatsProvider {
  return {
    isConfigured: () => true,
    getOverview: async () => OVERVIEW,
    getGrowth: async () => ({ ...OVERVIEW, netTrend: [{ date: '2026-10-01', net: 17 }] }),
    getRatings: async () => ({
      totals: OVERVIEW.totals,
      previous: OVERVIEW.previous,
      buckets: [{ stars: 5, count: 86, share: 0.672 }],
    }),
    ...overrides,
  };
}

const EMPTY_OVERVIEW: PlayOverview = {
  totals: { newInstalls: 0, activeInstalls: 0, uninstalls: 0, updates: 0, averageRating: 0, ratingCount: 0 },
  previous: { newInstalls: 0, activeInstalls: 0, uninstalls: 0, updates: 0, averageRating: 0, ratingCount: 0 },
  trend: [],
  topCountries: [],
};

function throwErr(err: unknown): never {
  throw err;
}

describe('GetPlayAnalyticsUseCase', () => {
  it('section overview -> status ok + data terisi', async () => {
    const uc = new GetPlayAnalyticsUseCase({ play: fakeProvider(), cacheTtlSeconds: 0, now: () => NOW });
    const report = await uc.execute({ section: 'overview', range: '7d' });
    expect(report.play.status).toBe('ok');
    expect(report.section).toBe('overview');
    expect(report.range.days).toBe(7);
  });

  it('tanpa konfigurasi -> not_configured', async () => {
    const uc = new GetPlayAnalyticsUseCase({
      play: fakeProvider({ isConfigured: () => false }),
      cacheTtlSeconds: 0,
      now: () => NOW,
    });
    const report = await uc.execute({ section: 'growth', range: '7d' });
    expect(report.play.status).toBe('not_configured');
    expect(report.play.errorCode).toBe('PLAY_NOT_CONFIGURED');
  });

  it('provider error -> status error di dalam 200 (bukan throw)', async () => {
    const play = fakeProvider({
      getOverview: () => throwErr(new AnalyticsProviderError('permission_denied', '403')),
    });
    const uc = new GetPlayAnalyticsUseCase({ play, cacheTtlSeconds: 0, now: () => NOW });
    const report = await uc.execute({ section: 'overview', range: '7d' });
    expect(report.play.status).toBe('error');
    expect(report.play.errorCode).toBe('PLAY_PERMISSION_DENIED');
  });

  it('data kosong -> status empty', async () => {
    const uc = new GetPlayAnalyticsUseCase({
      play: fakeProvider({ getOverview: async () => EMPTY_OVERVIEW }),
      cacheTtlSeconds: 0,
      now: () => NOW,
    });
    const report = await uc.execute({ section: 'overview', range: '7d' });
    expect(report.play.status).toBe('empty');
  });

  it('cache: panggilan kedua tidak memanggil provider lagi', async () => {
    let calls = 0;
    const play = fakeProvider({
      getOverview: async () => {
        calls += 1;
        return OVERVIEW;
      },
    });
    const uc = new GetPlayAnalyticsUseCase({ play, cacheTtlSeconds: 600, now: () => NOW });
    await uc.execute({ section: 'overview', range: '7d' });
    await uc.execute({ section: 'overview', range: '7d' });
    expect(calls).toBe(1);
  });

  it('rentang custom invalid -> ValidationError', async () => {
    const uc = new GetPlayAnalyticsUseCase({ play: fakeProvider(), cacheTtlSeconds: 0, now: () => NOW });
    await expect(
      uc.execute({ section: 'overview', range: 'custom', start: '2026-10-02', end: '2026-10-01' }),
    ).rejects.toMatchObject({ details: [{ field: 'start' }] });
  });
});
