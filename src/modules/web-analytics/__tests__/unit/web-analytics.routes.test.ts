import { describe, expect, it, vi } from 'vitest';

vi.mock('@/shared/logging/logger', () => ({ logger: { warn: vi.fn(), info: vi.fn(), error: vi.fn() } }));

import { Hono, type MiddlewareHandler } from 'hono';
import { errorHandler } from '@/shared/middlewares/error-handler.middleware';
import type { AppVariables } from '@/shared/types';
import { GetWebAnalyticsUseCase } from '../../application/use-cases/get-web-analytics.use-case';
import {
  FakeSearchAnalyticsProvider,
  FakeVisitorAnalyticsProvider,
} from '../../infrastructure/fake-web-analytics.provider';
import { WebAnalyticsController } from '../../presentation/v1/web-analytics.controller';
import { createWebAnalyticsRoutes } from '../../presentation/v1/web-analytics.routes';

function appAs(roles: string[]) {
  const authenticate: MiddlewareHandler<{ Variables: AppVariables }> = async (c, next) => {
    c.set('user', { id: 'u1', roles } as unknown as AppVariables['user']);
    await next();
  };
  const controller = new WebAnalyticsController({
    getReport: new GetWebAnalyticsUseCase({
      visitor: new FakeVisitorAnalyticsProvider(),
      search: new FakeSearchAnalyticsProvider(),
      ga4CacheTtlSeconds: 0,
      searchConsoleCacheTtlSeconds: 0,
    }),
  });
  const app = new Hono();
  app.onError(errorHandler);
  app.route('/wa', createWebAnalyticsRoutes({ controller, authenticate }));
  return app;
}

describe('web-analytics routes', () => {
  it('reviewer ditolak 403 (khusus admin/root)', async () => {
    const res = await appAs(['reviewer']).request('/wa/overview');
    expect(res.status).toBe(403);
  });

  it('admin: 200, wire snake_case, default 28 hari', async () => {
    const res = await appAs(['admin']).request('/wa/overview');
    expect(res.status).toBe(200);
    const body = (await res.json()) as { data: Record<string, any> };
    expect(body.data.range.days).toBe(28);
    expect(body.data.ga4.status).toBe('ok');
    expect(body.data.ga4.data.top_pages.length).toBeGreaterThan(0);
    expect(body.data.search_console.data.top_queries.length).toBeGreaterThan(0);
  });

  it('section asing & rentang custom tidak valid → 400', async () => {
    const app = appAs(['root']);
    expect((await app.request('/wa/ga4')).status).toBe(400);
    expect((await app.request('/wa/visitors?range=1y')).status).toBe(400);
    expect((await app.request('/wa/visitors?range=custom&start=2026-09-10')).status).toBe(400);
  });
});
