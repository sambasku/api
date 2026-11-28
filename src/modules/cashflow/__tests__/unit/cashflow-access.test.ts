import { describe, expect, it } from 'vitest';
import type { MiddlewareHandler } from 'hono';
import type { AppVariables } from '@/shared/types';
import { createAdminCashflowRoutes } from '../../presentation/v1/cashflow.routes';

/** Dependency yang meledak bila disentuh: bukti request ditolak SEBELUM masuk handler. */
function tripwire<T extends object>(): T {
  return new Proxy({} as T, {
    get(_t, prop) {
      throw new Error(`Handler terpanggil tanpa izin: ${String(prop)}`);
    },
  });
}

/** Authenticate palsu: roles dari header x-test-roles (dipisah koma). */
const fakeAuthenticate: MiddlewareHandler<{ Variables: AppVariables }> = async (c, next) => {
  const raw = c.req.header('x-test-roles');
  if (raw !== undefined) {
    const roles = raw.split(',').filter(Boolean);
    c.set('user', { user_id: 'u1', roles, role: roles[0] ?? 'contributor', azp: undefined, scope: undefined });
  }
  await next();
};

function buildApp() {
  return createAdminCashflowRoutes({
    service: tripwire(),
    attachments: tripwire(),
    authenticate: fakeAuthenticate,
  });
}

describe('akses Keuangan (cashflow): strict level admin ke atas', () => {
  const app = buildApp();
  // Semua route yang terdaftar (bukan middleware). Route baru otomatis ikut dicek.
  const daftar = app.routes.filter((r) => r.method !== 'ALL' && r.path !== '/*');

  it('router punya route yang bisa dicek', () => {
    expect(daftar.length).toBeGreaterThan(20);
  });

  const request = (method: string, path: string, roles?: string) =>
    app.request(path.replace(/:[A-Za-z]+/g, 'x'), {
      method,
      headers: roles === undefined ? {} : { 'x-test-roles': roles },
    });

  it.each(['reviewer', 'editor', 'contributor', 'reviewer,editor', '', 'superuser'])(
    'semua route 403 untuk roles "%s"',
    async (roles) => {
      for (const r of daftar) {
        const res = await request(r.method, r.path, roles);
        expect(res.status, `${r.method} ${r.path}`).toBe(403);
      }
    },
  );

  it('semua route 403 tanpa user (belum login)', async () => {
    for (const r of daftar) {
      const res = await request(r.method, r.path);
      expect(res.status, `${r.method} ${r.path}`).toBe(403);
    }
  });
});
