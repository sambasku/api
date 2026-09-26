import { describe, expect, it, vi } from 'vitest';
import { Hono } from 'hono';
import type { ApiClientRepository } from '@/modules/developer-oauth/domain/repositories/api-client.repository';
import type { AppVariables, AuthUser } from '@/shared/types';
import { createRequireApprovedClientMiddleware } from '../require-approved-client.middleware';

vi.mock('@/shared/config/env', () => ({
  env: { OAUTH_REQUIRE_AZP: true },
}));

function makeApp(
  repo: ApiClientRepository,
  opts: Parameters<typeof createRequireApprovedClientMiddleware>[1],
  seedUser?: AuthUser,
) {
  const app = new Hono<{ Variables: AppVariables }>();
  app.use('*', async (c, next) => {
    if (seedUser) c.set('user', seedUser);
    await next();
  });
  app.use('*', createRequireApprovedClientMiddleware(repo, opts));
  app.get('/', (c) => c.json({ ok: true }));
  return app;
}

describe('createRequireApprovedClientMiddleware', () => {
  const repo = {
    findByClientId: vi.fn(),
  } as unknown as ApiClientRepository;

  it('OAUTH_REQUIRE_AZP=true tanpa azp → CLIENT_REQUIRED', async () => {
    const app = makeApp(repo, { scope: 'vote.write' }, {
      user_id: 'u1',
      role: 'contributor',
    });
    const res = await app.request('/');
    expect(res.status).toBe(401);
    const body = (await res.json()) as { error_code: string };
    expect(body.error_code).toBe('CLIENT_REQUIRED');
  });

  it('allowMissingUser tanpa user → lolos (kontribusi anon)', async () => {
    const app = makeApp(repo, { scope: 'contribute.write', allowMissingUser: true });
    const res = await app.request('/');
    expect(res.status).toBe(200);
  });

  it('allowMissingUser dengan user tanpa azp → CLIENT_REQUIRED', async () => {
    const app = makeApp(repo, { scope: 'contribute.write', allowMissingUser: true }, {
      user_id: 'u1',
      role: 'contributor',
    });
    const res = await app.request('/');
    expect(res.status).toBe(401);
    const body = (await res.json()) as { error_code: string };
    expect(body.error_code).toBe('CLIENT_REQUIRED');
  });
});
