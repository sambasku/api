import { describe, it, expect, beforeAll } from 'vitest';
import { config } from 'dotenv';
import { eq } from 'drizzle-orm';
import { capturedOtpDisplayCode, e2eRegisterBody } from '@/shared/testing/e2e-auth';

const { parsed } = config({ path: '.env.test', quiet: true });
const hasTestDb = !!parsed?.DATABASE_URL;
if (parsed?.DATABASE_URL) process.env.DATABASE_URL = parsed.DATABASE_URL;

describe.skipIf(!hasTestDb)('Layanan E2E', () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let app: any;
  let adminToken: string;
  let userToken: string;

  const KEC_ID = '01E2EREGIONKEC0000000001';
  const DESA_ID = '01E2EREGIONDESA000000001';
  const OTHER_KEC = '01E2EREGIONKEC0000000002';

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
  const get = (path: string, token?: string) =>
    request(path, { headers: token ? { authorization: `Bearer ${token}` } : {} });

  const body = (over: Record<string, unknown> = {}) => ({
    category: 'ambulance',
    name: 'Ambulans RSUD',
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
      { id: DESA_ID, slug: 'pemangkat/perapakan', name: 'Perapakan', type: 'desa', parentId: KEC_ID, status: 'published' },
      { id: OTHER_KEC, slug: 'jawai', name: 'Jawai', type: 'kecamatan', status: 'published' },
    ]);
    const appModule = await import('@/app');
    app = appModule.app;
    const stamp = Date.now();
    const adminEmail = `adml${stamp}@test.com`;
    const userEmail = `usrl${stamp}@test.com`;
    await post('/api/v1/auth/register', e2eRegisterBody({ name: `adml${stamp}`, email: adminEmail }));
    await post('/api/v1/auth/verify-email', { email: adminEmail, code: capturedOtpDisplayCode() });
    const [uid] = await db.select({ id: users.id }).from(users).where(eq(users.email, adminEmail)).limit(1);
    if (uid) await db.insert(userRoles).values({ userId: uid.id, role: 'admin' }).onConflictDoNothing();
    adminToken = (await (await post('/api/v1/auth/login', { email: adminEmail, password: 'Password123' })).json()).data.access_token;
    await post('/api/v1/auth/register', e2eRegisterBody({ name: `usrl${stamp}`, email: userEmail }));
    await post('/api/v1/auth/verify-email', { email: userEmail, code: capturedOtpDisplayCode() });
    userToken = (await (await post('/api/v1/auth/login', { email: userEmail, password: 'Password123' })).json()).data.access_token;
  });

  it('usulan pending tidak tayang, approve baru muncul dan bisa difilter', async () => {
    const hidden = await get(`/api/v1/layanan?region_id=${KEC_ID}`);
    expect((await hidden.json()).data.items).toEqual([]);

    const submitted = await post('/api/v1/layanan-contributions', body(), userToken);
    expect(submitted.status).toBe(201);
    const contributionId = (await submitted.json()).data.id;
    const stillHidden = await get(`/api/v1/layanan?region_id=${KEC_ID}`);
    expect((await stillHidden.json()).data.items).toEqual([]);

    const approved = await post(`/api/v1/admin/layanan-contributions/${contributionId}/approve`, {}, adminToken);
    expect(approved.status).toBe(200);
    const listed = await get('/api/v1/layanan?region_id=pemangkat&category=ambulance');
    const items = (await listed.json()).data.items;
    expect(items).toHaveLength(1);
    expect(items[0].name).toBe('Ambulans RSUD');
    expect(items[0].region_name).toBe('Pemangkat');
    expect(items[0].phones).toEqual([{ phone: '081234567890', note: 'Pos utama', whatsapp: null }]);

    const fire = await post(
      '/api/v1/layanan-contributions',
      body({
        category: 'fire',
        name: 'Damkar Pemangkat',
        phones: [
          { phone: '081200000001', note: 'Shift pagi' },
          { phone: '081200000002', note: 'Shift malam' },
        ],
        logo_url: 'https://cdn.example.com/damkar.png',
      }),
      userToken,
    );
    const fireId = (await fire.json()).data.id;
    await post(`/api/v1/admin/layanan-contributions/${fireId}/approve`, {}, adminToken);
    const onlyFire = await get('/api/v1/layanan?region_id=pemangkat&category=fire');
    const fireItems = (await onlyFire.json()).data.items;
    expect(fireItems.map((row: { name: string }) => row.name)).toEqual(['Damkar Pemangkat']);
    expect(fireItems[0].phones).toHaveLength(2);
    expect(fireItems[0].logo_url).toBe('https://cdn.example.com/damkar.png');
    const other = await get(`/api/v1/layanan?region_id=${OTHER_KEC}`);
    expect((await other.json()).data.items).toEqual([]);
  });

  it('nomor kosong 400 dan desa sebagai kecamatan ditolak', async () => {
    const blank = await post('/api/v1/layanan-contributions', body({ phones: [] }), userToken);
    expect(blank.status).toBe(400);
    const desa = await post(
      '/api/v1/layanan-contributions',
      body({ region_id: DESA_ID }),
      userToken,
    );
    expect(desa.status).toBe(404);
    expect((await desa.json()).error_code).toBe('REGION_NOT_FOUND');
  });

  it('admin buat lalu unpublish membuat detail 404', async () => {
    const created = await post(
      '/api/v1/admin/layanan',
      body({
        name: 'Pos Damkar',
        category: 'fire',
        phones: [{ phone: '081211112222' }],
      }),
      adminToken,
    );
    expect(created.status).toBe(201);
    const data = (await created.json()).data;
    const visible = await get(`/api/v1/layanan/${data.slug}`);
    expect(visible.status).toBe(200);
    const hidden = await post(`/api/v1/admin/layanan/${data.id}/unpublish`, {}, adminToken);
    expect(hidden.status).toBe(200);
    const gone = await get(`/api/v1/layanan/${data.slug}`);
    expect(gone.status).toBe(404);
  });
});
