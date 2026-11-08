import { describe, it, expect, beforeAll } from 'vitest';
import { config } from 'dotenv';
import { eq } from 'drizzle-orm';
import {
  capturedOtpDisplayCode,
  e2eRegisterBody,
} from '@/shared/testing/e2e-auth';

const { parsed } = config({ path: '.env.test', quiet: true });
const hasTestDb = !!parsed?.DATABASE_URL;
if (parsed?.DATABASE_URL) process.env.DATABASE_URL = parsed.DATABASE_URL;

describe.skipIf(!hasTestDb)('Layanan publik E2E', () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let app: any;
  let adminToken: string;
  let userToken: string;

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
    request(path, {
      headers: token ? { authorization: `Bearer ${token}` } : {},
    });

  const KEC_ID = '01E2EREGIONKEC0000000001';
  const DESA_ID = '01E2EREGIONDESA000000001';

  const body = (over: Record<string, unknown> = {}) => ({
    category: 'ambulance',
    name: 'Ambulans Puskesmas Pemangkat',
    phone: '081234567890',
    region_id: KEC_ID,
    ...over,
  });

  beforeAll(async () => {
    const { getTestDb } = await import('@/shared/database/drizzle/test-client');
    const { regions, userRoles, users } = await import(
      '@/shared/database/drizzle/schema'
    );
    const { truncateAll } = await import('@/shared/database/drizzle/test-utils');
    const db = getTestDb();
    await truncateAll(db);
    await db.insert(regions).values([
      {
        id: KEC_ID,
        slug: 'pemangkat',
        name: 'Pemangkat',
        type: 'kecamatan',
        status: 'published',
      },
      {
        id: DESA_ID,
        slug: 'pemangkat/perapakan',
        name: 'Perapakan',
        type: 'desa',
        parentId: KEC_ID,
        status: 'published',
      },
      {
        id: '01E2EREGIONKAB0000000001',
        slug: 'bukan-kecamatan',
        name: 'Desa Nyasar',
        type: 'desa',
        status: 'published',
      },
    ]);

    const appModule = await import('@/app');
    app = appModule.app;
    const stamp = Date.now();
    await post(
      '/api/v1/auth/register',
      e2eRegisterBody({ name: `adml${stamp}`, email: `adml${stamp}@test.com` }),
    );
    await post('/api/v1/auth/verify-email', {
      email: `adml${stamp}@test.com`,
      code: capturedOtpDisplayCode(),
    });
    const [uid] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, `adml${stamp}@test.com`))
      .limit(1);
    if (uid) {
      await db
        .insert(userRoles)
        .values({ userId: uid.id, role: 'admin' })
        .onConflictDoNothing();
    }
    adminToken = (
      await (
        await post('/api/v1/auth/login', {
          email: `adml${stamp}@test.com`,
          password: 'Password123',
        })
      ).json()
    ).data.access_token;

    await post(
      '/api/v1/auth/register',
      e2eRegisterBody({ name: `usrl${stamp}`, email: `usrl${stamp}@test.com` }),
    );
    await post('/api/v1/auth/verify-email', {
      email: `usrl${stamp}@test.com`,
      code: capturedOtpDisplayCode(),
    });
    userToken = (
      await (
        await post('/api/v1/auth/login', {
          email: `usrl${stamp}@test.com`,
          password: 'Password123',
        })
      ).json()
    ).data.access_token;
  });

  it('usulan pending tidak tayang, approve tayang dan terfilter kecamatan', async () => {
    const hidden = await get('/api/v1/layanan?region_id=pemangkat');
    expect(hidden.status).toBe(200);
    expect((await hidden.json()).data.items).toEqual([]);

    const submit = await post(
      '/api/v1/layanan-contributions',
      body({ category: 'fire', name: 'Damkar Pemangkat' }),
      userToken,
    );
    expect(submit.status).toBe(201);
    const contributionId = (await submit.json()).data.id;

    const stillHidden = await get('/api/v1/layanan?region_id=pemangkat');
    expect((await stillHidden.json()).data.items).toEqual([]);

    const approve = await post(
      `/api/v1/admin/layanan-contributions/${contributionId}/approve`,
      {},
      adminToken,
    );
    expect(approve.status).toBe(200);

    const listed = await get('/api/v1/layanan?region_id=pemangkat&category=fire');
    const items = (await listed.json()).data.items;
    expect(items).toHaveLength(1);
    expect(items[0].name).toBe('Damkar Pemangkat');
    expect(items[0].phone).toBe('081234567890');
    expect(items[0].region_slug).toBe('pemangkat');

    const other = await get('/api/v1/layanan?region_id=tidak-ada');
    expect((await other.json()).data.items).toEqual([]);
  });

  it('telepon kosong dan kecamatan bukan kecamatan ditolak', async () => {
    const noPhone = await post(
      '/api/v1/layanan-contributions',
      body({ phone: '   ' }),
      userToken,
    );
    expect(noPhone.status).toBe(400);

    const badRegion = await post(
      '/api/v1/layanan-contributions',
      body({ region_id: 'bukan-kecamatan', name: 'Ambulans Salah Wilayah' }),
      userToken,
    );
    expect(badRegion.status).toBe(400);
    expect((await badRegion.json()).error_code).toBe('REGION_NOT_FOUND');
  });

  it('admin turunkan membuat listing hilang dari GET publik', async () => {
    const created = await post(
      '/api/v1/admin/layanan',
      body({ name: 'Ambulans RSUD', category: 'ambulance' }),
      adminToken,
    );
    expect(created.status).toBe(201);
    const data = (await created.json()).data;
    const down = await post(
      `/api/v1/admin/layanan/${data.id}/unpublish`,
      {},
      adminToken,
    );
    expect(down.status).toBe(200);
    const detail = await get(`/api/v1/layanan/${data.slug}`);
    expect(detail.status).toBe(404);
  });
});
