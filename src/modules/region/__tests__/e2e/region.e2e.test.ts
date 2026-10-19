import { describe, it, expect, beforeAll } from 'vitest';
import { config } from 'dotenv';
import { capturedOtpDisplayCode, e2eRegisterBody } from '@/shared/testing/e2e-auth';
import { eq } from 'drizzle-orm';

const { parsed } = config({ path: '.env.test', quiet: true });
const hasTestDb = !!parsed?.DATABASE_URL;
if (parsed?.DATABASE_URL) process.env.DATABASE_URL = parsed.DATABASE_URL;

describe.skipIf(!hasTestDb)('Region E2E - CRUD admin + list publik', () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let app: any;
  let adminToken: string;

  const request = (path: string, init: RequestInit = {}) =>
    app.request(path, {
      ...init,
      headers: { 'content-type': 'application/json', ...(init.headers ?? {}) },
    });
  const post = (path: string, body: unknown, token?: string) =>
    request(path, {
      method: 'POST',
      body: JSON.stringify(body),
      headers: token ? { authorization: `Bearer ${token}` } : {},
    });
  const patch = (path: string, body: unknown, token?: string) =>
    request(path, {
      method: 'PATCH',
      body: JSON.stringify(body),
      headers: token ? { authorization: `Bearer ${token}` } : {},
    });
  const get = (path: string, token?: string) =>
    request(path, { headers: token ? { authorization: `Bearer ${token}` } : {} });
  const del = (path: string, token?: string) =>
    request(path, {
      method: 'DELETE',
      headers: token ? { authorization: `Bearer ${token}` } : {},
    });

  beforeAll(async () => {
    const { getTestDb } = await import('@/shared/database/drizzle/test-client');
    const { languages, userRoles, users, wordClasses } = await import(
      '@/shared/database/drizzle/schema'
    );
    const { truncateAll } = await import('@/shared/database/drizzle/test-utils');
    const db = getTestDb();
    await truncateAll(db);
    const ulid26 = (prefix: string) => prefix.padEnd(26, '0').slice(0, 26);
    await db.insert(languages).values([
      { id: ulid26('01E2ELANGSMB'), code: 'smb', name: 'Sambas' },
      { id: ulid26('01E2ELANGIDN'), code: 'id', name: 'Indonesia' },
    ]);
    await db.insert(wordClasses).values({
      id: ulid26('01E2EWCNOMINA'),
      code: 'n',
      name: 'Nomina',
    });

    const appModule = await import('@/app');
    app = appModule.app;

    const stamp = Date.now();
    await post(
      '/api/v1/auth/register',
      e2eRegisterBody({ name: `adm${stamp}`, email: `adm${stamp}@test.com` }),
    );
    await post('/api/v1/auth/verify-email', {
      email: `adm${stamp}@test.com`,
      code: capturedOtpDisplayCode(),
    });
    const [uid] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, `adm${stamp}@test.com`))
      .limit(1);
    if (uid) await db.insert(userRoles).values({ userId: uid.id, role: 'admin' }).onConflictDoNothing();
    adminToken = (
      (await (await post('/api/v1/auth/login', { email: `adm${stamp}@test.com`, password: 'Password123' })).json())
        .data
    ).access_token;
  });

  it('admin create kecamatan+desa → publik list → hapus anak dulu → hapus induk', async () => {
    const kecRes = await post(
      '/api/v1/admin/regions',
      {
        id: 'pemangkat-e2e',
        name: 'Pemangkat E2E',
        type: 'kecamatan',
        lat: 1.17,
        lng: 108.97,
      },
      adminToken,
    );
    expect(kecRes.status).toBe(200);
    expect((await kecRes.json()).data.type).toBe('kecamatan');

    const desaRes = await post(
      '/api/v1/admin/regions',
      {
        id: 'pemangkat-e2e/perapakan',
        name: 'Perapakan',
        type: 'desa',
        parent_id: 'pemangkat-e2e',
        code: '6101020011',
      },
      adminToken,
    );
    expect(desaRes.status).toBe(200);
    expect((await desaRes.json()).data.parent_id).toBe('pemangkat-e2e');

    const listRes = await get('/api/v1/regions?type=desa&parent_id=pemangkat-e2e');
    expect(listRes.status).toBe(200);
    const items = (await listRes.json()).data.items;
    expect(items.some((r: { id: string }) => r.id === 'pemangkat-e2e/perapakan')).toBe(true);

    const detailRes = await get('/api/v1/regions/by-id?id=pemangkat-e2e%2Fperapakan');
    expect(detailRes.status).toBe(200);
    expect((await detailRes.json()).data.name).toBe('Perapakan');

    const blockParent = await del('/api/v1/admin/regions/by-id?id=pemangkat-e2e', adminToken);
    expect(blockParent.status).toBe(409);
    expect((await blockParent.json()).error_code).toBe('REGION_HAS_CHILDREN');

    const delDesa = await del(
      '/api/v1/admin/regions/by-id?id=pemangkat-e2e%2Fperapakan',
      adminToken,
    );
    expect(delDesa.status).toBe(200);

    const delKec = await del('/api/v1/admin/regions/by-id?id=pemangkat-e2e', adminToken);
    expect(delKec.status).toBe(200);

    const gone = await get('/api/v1/regions/by-id?id=pemangkat-e2e');
    expect(gone.status).toBe(404);
  });
});
