import { describe, expect, it, vi } from 'vitest';

vi.mock('@/shared/logging/logger', () => ({ logger: { warn: vi.fn(), info: vi.fn(), error: vi.fn() } }));

import { ValidationError } from '@/shared/errors/app-error';
import {
  AnalyticsProviderError,
  type SearchAnalyticsProvider,
  type VisitorAnalyticsProvider,
} from '../../application/ports/analytics-provider.port';
import { GetWebAnalyticsUseCase } from '../../application/use-cases/get-web-analytics.use-case';
import {
  FakeSearchAnalyticsProvider,
  FakeVisitorAnalyticsProvider,
} from '../../infrastructure/fake-web-analytics.provider';
import { toSnakeKeys } from '../../presentation/v1/web-analytics.controller';

const NOW = new Date('2026-10-03T03:00:00Z');

function build(overrides: { visitor?: Partial<VisitorAnalyticsProvider>; search?: Partial<SearchAnalyticsProvider> } = {}) {
  const visitor = Object.assign(new FakeVisitorAnalyticsProvider(), overrides.visitor);
  const search = Object.assign(new FakeSearchAnalyticsProvider(), overrides.search);
  const useCase = new GetWebAnalyticsUseCase({
    visitor,
    search,
    ga4CacheTtlSeconds: 1800,
    searchConsoleCacheTtlSeconds: 21600,
    now: () => NOW,
  });
  return { useCase, visitor, search };
}

describe('GetWebAnalyticsUseCase', () => {
  it('overview: dua provider ok, range GSC digeser lag 3 hari', async () => {
    const { useCase } = build();
    const report = await useCase.execute({ section: 'overview', range: '28d' });
    expect(report.range).toMatchObject({ start: '2026-09-05', end: '2026-10-02', days: 28 });
    expect(report.ga4?.status).toBe('ok');
    expect(report.ga4?.range).toEqual({ start: '2026-09-05', end: '2026-10-02' });
    expect(report.searchConsole?.status).toBe('ok');
    expect(report.searchConsole?.range).toEqual({ start: '2026-09-03', end: '2026-09-30' });
  });

  it('section hanya memanggil provider yang relevan', async () => {
    const { useCase } = build();
    const visitors = await useCase.execute({ section: 'visitors', range: '7d' });
    expect(visitors.ga4?.status).toBe('ok');
    expect(visitors.searchConsole).toBeUndefined();
    const search = await useCase.execute({ section: 'search', range: '7d' });
    expect(search.ga4).toBeUndefined();
    expect(search.searchConsole?.status).toBe('ok');
  });

  it('provider belum dikonfigurasi → not_configured, tanpa memanggil provider', async () => {
    const getOverview = vi.fn();
    const { useCase } = build({ search: { isConfigured: () => false, getOverview } });
    const report = await useCase.execute({ section: 'overview', range: '28d' });
    expect(report.searchConsole).toMatchObject({ status: 'not_configured', errorCode: 'SEARCH_CONSOLE_NOT_CONFIGURED' });
    expect(getOverview).not.toHaveBeenCalled();
    expect(report.ga4?.status).toBe('ok');
  });

  it('data nol → empty, bukan error', async () => {
    const zero = { activeUsers: 0, totalUsers: 0, newUsers: 0, sessions: 0, pageViews: 0, eventCount: 0, engagementRate: 0 };
    const { useCase } = build({
      visitor: { getBehavior: async () => ({ totals: zero, previous: zero, topPages: [], landingPages: [], events: [] }) },
    });
    const report = await useCase.execute({ section: 'behavior', range: '7d' });
    expect(report.ga4).toMatchObject({ status: 'empty', errorCode: null, data: null });
  });

  it.each([
    ['permission_denied', 'GA4_PERMISSION_DENIED'],
    ['rate_limited', 'GA4_RATE_LIMITED'],
    ['upstream', 'GA4_UPSTREAM_ERROR'],
    ['network', 'GA4_NETWORK_ERROR'],
  ] as const)('error %s → %s, provider lain tetap tampil', async (kind, code) => {
    const { useCase } = build({
      visitor: { getOverview: async () => Promise.reject(new AnalyticsProviderError(kind, 'boom')) },
    });
    const report = await useCase.execute({ section: 'overview', range: '28d' });
    expect(report.ga4).toMatchObject({ status: 'error', errorCode: code, data: null });
    expect(report.ga4?.message).toBeTruthy();
    expect(report.searchConsole?.status).toBe('ok');
  });

  it('error tak dikenal dipetakan ke UPSTREAM_ERROR tanpa membocorkan pesan internal', async () => {
    const { useCase } = build({ search: { getSearch: async () => Promise.reject(new TypeError('x is undefined')) } });
    const report = await useCase.execute({ section: 'search', range: '7d' });
    expect(report.searchConsole?.errorCode).toBe('SEARCH_CONSOLE_UPSTREAM_ERROR');
    expect(report.searchConsole?.message).not.toContain('undefined');
  });

  it('hasil ok di-cache per section+range; error tidak di-cache', async () => {
    const { useCase, visitor } = build();
    const spy = vi.spyOn(visitor, 'getSources');
    await useCase.execute({ section: 'sources', range: '28d' });
    await useCase.execute({ section: 'sources', range: '28d' });
    expect(spy).toHaveBeenCalledTimes(1);
    await useCase.execute({ section: 'sources', range: '7d' });
    expect(spy).toHaveBeenCalledTimes(2);

    const failing = vi.fn().mockRejectedValue(new AnalyticsProviderError('rate_limited', '429'));
    const { useCase: uc2 } = build({ visitor: { getSources: failing } });
    await uc2.execute({ section: 'sources', range: '28d' });
    await uc2.execute({ section: 'sources', range: '28d' });
    expect(failing).toHaveBeenCalledTimes(2);
  });

  it('rentang custom tidak valid → ValidationError (400)', async () => {
    const { useCase } = build();
    await expect(
      useCase.execute({ section: 'overview', range: 'custom', start: '2026-09-10', end: '2026-09-01' }),
    ).rejects.toBeInstanceOf(ValidationError);
  });
});

describe('toSnakeKeys', () => {
  it('ubah key bersarang, nilai string tetap', () => {
    expect(toSnakeKeys({ topPages: [{ pagePath: '/a', engagementRate: 1 }], channel: 'organic_search' })).toEqual({
      top_pages: [{ page_path: '/a', engagement_rate: 1 }],
      channel: 'organic_search',
    });
  });
});
