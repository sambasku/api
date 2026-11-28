import { describe, expect, it } from 'vitest';
import type { MiddlewareHandler } from 'hono';
import type { AppVariables } from '@/shared/types';
import { AppError } from '@/shared/errors/app-error';
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

describe('GET /transactions: validasi rentang tanggal', () => {
  const diterima: unknown[] = [];
  const app = createAdminCashflowRoutes({
    service: {
      listTransaksi: async (opts: unknown) => {
        diterima.push(opts);
        return [];
      },
    } as never,
    attachments: { hitungPerTransaksi: async () => new Map() } as never,
    authenticate: fakeAuthenticate,
  });
  // Handler error global dimuat dengan env penuh; di sini cukup memetakan AppError ke status-nya.
  app.onError((err, c) =>
    err instanceof AppError ? c.json({ error_code: err.errorCode }, err.statusCode as 400) : c.json({}, 500),
  );
  const get = (qs: string) => app.request(`/transactions${qs}`, { headers: { 'x-test-roles': 'admin' } });

  it('from dan to diteruskan ke service, limit dibatasi 500', async () => {
    const res = await get('?from=2026-01-01&to=2026-01-31&limit=9999');
    expect(res.status).toBe(200);
    expect(diterima.at(-1)).toEqual({ limit: 500, from: '2026-01-01', to: '2026-01-31' });
  });

  it('tanpa from dan to tetap jalan', async () => {
    const res = await get('');
    expect(res.status).toBe(200);
    expect(diterima.at(-1)).toEqual({ limit: 50, from: undefined, to: undefined });
  });

  it('format salah atau from setelah to ditolak 400', async () => {
    expect((await get('?from=28-11-2026')).status).toBe(400);
    expect((await get('?from=2026-02-01&to=2026-01-01')).status).toBe(400);
  });
});
