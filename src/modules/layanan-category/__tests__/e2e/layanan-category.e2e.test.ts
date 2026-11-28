import { describe, it, expect, beforeAll } from 'vitest';
import { config } from 'dotenv';
import { eq } from 'drizzle-orm';
import { capturedOtpDisplayCode, e2eRegisterBody } from '@/shared/testing/e2e-auth';

const { parsed } = config({ path: '.env.test', quiet: true });
const hasTestDb = !!parsed?.DATABASE_URL;
if (parsed?.DATABASE_URL) process.env.DATABASE_URL = parsed.DATABASE_URL;

describe.skipIf(!hasTestDb)('Layanan category master E2E', () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let app: any;
  let adminToken: string;
  let userToken: string;

  const KEC_ID = '01E2ELCATREGIONKEC0000001';

  const request = (path: string, init: RequestInit = {}) =>
    app.request(path, {
      ...init,
      headers: { 'content-type': 'application/json', ...(init.headers ?? {}) },
    });
  const authed = (token?: string) => (token ? { authorization: `Bearer ${token}` } : {});
  const post = (path: string, body: unknown, token?: string) =>
    request(path, { method: 'POST', body: JSON.stringify(body), headers: authed(token) });
  const patch = (path: string, body: unknown, token?: string) =>
    request(path, { method: 'PATCH', body: JSON.stringify(body), headers: authed(token) });
  const del = (path: string, token?: string) => request(path, { method: 'DELETE', headers: authed(token) });
  const get = (path: string, token?: string) => request(path, { headers: authed(token) });

  const layananBody = (over: Record<string, unknown> = {}) => ({
    category: 'pmi',
    name: 'PMI Kabupaten',
    phones: [{ phone: '081234567890', note: 'Pos utama' }],
    region_id: KEC_ID,
    ...over,
  });

  beforeAll(async () => {
    const { getTestDb } = await import('@/shared/database/drizzle/test-client');
    const { regions, userRoles, users } = await import('@/shared/database/drizzle/schema');
    const { truncateAll } = await import('@/shared/database/drizzle/test-utils');
    const db = getTestDb();
    await truncateAll(db);
    await db.insert(regions).values([
      { id: KEC_ID, slug: 'pemangkat', name: 'Pemangkat', type: 'kecamatan', status: 'published' },
    ]);
    const appModule = await import('@/app');
    app = appModule.app;
    const stamp = Date.now();
    const adminEmail = `admlc${stamp}@test.com`;
    const userEmail = `usrlc${stamp}@test.com`;
    await post('/api/v1/auth/register', e2eRegisterBody({ name: `admlc${stamp}`, email: adminEmail }));
    await post('/api/v1/auth/verify-email', { email: adminEmail, code: capturedOtpDisplayCode() });
    const [uid] = await db.select({ id: users.id }).from(users).where(eq(users.email, adminEmail)).limit(1);
    if (uid) await db.insert(userRoles).values({ userId: uid.id, role: 'admin' }).onConflictDoNothing();
    adminToken = (await (await post('/api/v1/auth/login', { email: adminEmail, password: 'Password123' })).json()).data
      .access_token;
    await post('/api/v1/auth/register', e2eRegisterBody({ name: `usrlc${stamp}`, email: userEmail }));
    await post('/api/v1/auth/verify-email', { email: userEmail, code: capturedOtpDisplayCode() });
    userToken = (await (await post('/api/v1/auth/login', { email: userEmail, password: 'Password123' })).json()).data
      .access_token;
  });

  it('master publik memuat 3 kategori seed dengan label singkat dan ikon', async () => {
    const res = await get('/api/v1/layanan-categories');
    expect(res.status).toBe(200);
    const items = (await res.json()).data.items as Array<{ id: string; short_label: string; icon: string }>;
    const byId = Object.fromEntries(items.map((i) => [i.id, i]));
    expect(byId.ambulance).toMatchObject({ short_label: 'Ambulan', icon: 'ambulance' });
    expect(byId.fire).toMatchObject({ short_label: 'Damkar', icon: 'flame' });
    // PMI diarsipkan sampai rilis klien baru, jadi belum tampil publik.
    expect(byId.pmi).toBeUndefined();
  });

  it('usulan dengan kategori pmi bisa diajukan lalu tayang dan bisa difilter', async () => {
    // PMI seed diarsipkan sampai rilis klien baru; admin mengaktifkannya dulu.
    const activated = await patch('/api/v1/admin/layanan-categories/by-id?id=pmi', { status: 'published' }, adminToken);
    expect(activated.status).toBe(200);
    const submitted = await post('/api/v1/layanan-contributions', layananBody(), userToken);
    expect(submitted.status).toBe(201);
    const contributionId = (await submitted.json()).data.id;
    const approved = await post(`/api/v1/admin/layanan-contributions/${contributionId}/approve`, {}, adminToken);
    expect(approved.status).toBe(200);
    const listed = await get(`/api/v1/layanan?region_id=${KEC_ID}&category=pmi`);
    const items = (await listed.json()).data.items as Array<{ category: string }>;
    expect(items).toHaveLength(1);
    expect(items[0]?.category).toBe('pmi');
  });

  it('kategori tidak dikenal ditolak untuk usulan baru', async () => {
    const res = await post('/api/v1/layanan-contributions', layananBody({ category: 'tidak-ada' }), userToken);
    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(res.status).toBeLessThan(500);
  });

  it('label singkat duplikat ditolak (409)', async () => {
    const res = await post(
      '/api/v1/admin/layanan-categories',
      { id: 'sar', name: 'Search and Rescue', short_label: 'PMI' },
      adminToken,
    );
    expect(res.status).toBe(409);
    expect((await res.json()).error_code).toBe('CATEGORY_SHORT_LABEL_TAKEN');
  });

  it('arsip: layanan lama tetap tampil, tapi kategori tidak bisa dipilih untuk usulan baru', async () => {
    const archived = await patch('/api/v1/admin/layanan-categories/by-id?id=pmi', { status: 'archived' }, adminToken);
    expect(archived.status).toBe(200);

    const publicList = await get('/api/v1/layanan-categories');
    const ids = ((await publicList.json()).data.items as Array<{ id: string }>).map((i) => i.id);
    expect(ids).toContain('pmi');

    const listed = await get(`/api/v1/layanan?region_id=${KEC_ID}&category=pmi`);
    expect((await listed.json()).data.items).toHaveLength(1);

    const newUsul = await post('/api/v1/layanan-contributions', layananBody({ name: 'PMI Baru' }), userToken);
    expect(newUsul.status).toBeGreaterThanOrEqual(400);
    expect(newUsul.status).toBeLessThan(500);
  });

  it('hapus kategori yang masih dipakai layanan ditolak (409)', async () => {
    const res = await del('/api/v1/admin/layanan-categories/by-id?id=pmi', adminToken);
    expect(res.status).toBe(409);
    expect((await res.json()).error_code).toBe('CATEGORY_IN_USE');
  });
});
