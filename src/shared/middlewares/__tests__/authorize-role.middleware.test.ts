import { describe, expect, it } from 'vitest';
import { Hono } from 'hono';
import type { AppVariables, AuthUser } from '@/shared/types';
import { authorizeRole, requireMinRole } from '../authorize-role.middleware';

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

describe('requireMinRole (level role, fail-closed)', () => {
  function appMin(seedUser?: AuthUser) {
    const app = new Hono<{ Variables: AppVariables }>();
    app.use('*', async (c, next) => {
      if (seedUser) c.set('user', seedUser);
      await next();
    });
    app.use('*', requireMinRole('admin'));
    app.get('/', (c) => c.json({ ok: true }));
    return app;
  }
  const statusFor = async (roles: string[], role = roles[0] ?? 'contributor') =>
    (await appMin({ ...base, roles, role }).request('/')).status;

  it('admin dan root lolos (level >= admin)', async () => {
    expect(await statusFor(['admin'])).toBe(200);
    expect(await statusFor(['root'])).toBe(200);
  });

  it('multi role: level tertinggi yang dihitung', async () => {
    expect(await statusFor(['contributor', 'admin'])).toBe(200);
  });

  it('reviewer, editor, contributor ditolak 403', async () => {
    expect(await statusFor(['reviewer'])).toBe(403);
    expect(await statusFor(['editor'])).toBe(403);
    expect(await statusFor(['contributor'])).toBe(403);
    expect(await statusFor(['reviewer', 'editor'])).toBe(403);
  });

  it('roles kosong, role tak dikenal, dan nama prototipe ditolak', async () => {
    expect(await statusFor([])).toBe(403);
    expect(await statusFor(['superuser'])).toBe(403);
    expect(await statusFor(['constructor', 'toString'])).toBe(403);
  });

  it('klaim role deprecated tidak dipercaya: hanya roles[] yang dihitung', async () => {
    expect(await statusFor(['contributor'], 'admin')).toBe(403);
  });

  it('tanpa user = 403', async () => {
    expect((await appMin(undefined).request('/')).status).toBe(403);
  });
});
