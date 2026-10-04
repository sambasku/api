import { describe, expect, it } from 'vitest';
import { Hono } from 'hono';
import type { AppVariables, AuthUser } from '@/shared/types';
import { authorizeRole } from '../authorize-role.middleware';

function makeApp(seedUser?: AuthUser) {
  const app = new Hono<{ Variables: AppVariables }>();
  app.use('*', async (c, next) => {
    if (seedUser) c.set('user', seedUser);
    await next();
  });
  app.use('*', authorizeRole('admin', 'root', 'reviewer'));
  app.get('/', (c) => c.json({ ok: true }));
  return app;
}

const base = { user_id: 'u1', azp: undefined, scope: undefined };

describe('authorizeRole (multi role interseksi)', () => {
  it('lolos bila punya SALAH SATU role yang diizinkan', async () => {
    const res = await makeApp({ ...base, roles: ['contributor', 'reviewer'], role: 'reviewer' }).request('/');
    expect(res.status).toBe(200);
  });

  it('403 bila tidak ada role yang cocok (kasus dashboard #33: contributor)', async () => {
    const res = await makeApp({ ...base, roles: ['contributor'], role: 'contributor' }).request('/');
    expect(res.status).toBe(403);
    const body = (await res.json()) as { error_code: string };
    expect(body.error_code).toBe('FORBIDDEN');
  });

  it('403 tanpa user (belum authenticate)', async () => {
    const res = await makeApp(undefined).request('/');
    expect(res.status).toBe(403);
  });
});
