import { describe, it, expect, beforeAll } from 'vitest';
import { config } from 'dotenv';
import {
  capturedOtpDisplayCode,
  e2eRegisterBody,
} from '@/shared/testing/e2e-auth';
import { eq } from 'drizzle-orm';

const { parsed } = config({ path: '.env.test', quiet: true });
const hasTestDb = !!parsed?.DATABASE_URL;
if (parsed?.DATABASE_URL) process.env.DATABASE_URL = parsed.DATABASE_URL;

const KEC = '01E2ELAYANANVIEWKEC0001';

describe.skipIf(!hasTestDb)('Layanan views E2E', () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let app: any;
  let adminToken: string;
  const layananId = '01E2ELAYANANVIEWPUB00001';
  const slug = 'layanan-view-e2e';

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

  beforeAll(async () => {
    const { getTestDb } = await import('@/shared/database/drizzle/test-client');
    const schema = await import('@/shared/database/drizzle/schema');
    const { truncateAll } = await import('@/shared/database/drizzle/test-utils');
    const db = getTestDb();
    await truncateAll(db);

    const appModule = await import('@/app');
    app = appModule.app;

    const stamp = Date.now();
    await post(
      '/api/v1/auth/register',
      e2eRegisterBody({ name: `ladm${stamp}`, email: `ladm${stamp}@test.com` }),
    );
    await post('/api/v1/auth/verify-email', {
      email: `ladm${stamp}@test.com`,
      code: capturedOtpDisplayCode(),
    });
    const [uid] = await db
      .select({ id: schema.users.id })
      .from(schema.users)
      .where(eq(schema.users.email, `ladm${stamp}@test.com`))
      .limit(1);
    if (uid) {
      await db
        .insert(schema.userRoles)
        .values({ userId: uid.id, role: 'admin' })
        .onConflictDoNothing();
    }
    adminToken = (
      await (
        await post('/api/v1/auth/login', {
          email: `ladm${stamp}@test.com`,
          password: 'Password123',
        })
      ).json()
    ).data.access_token;

    const now = new Date();
    await db.insert(schema.regions).values({
      id: KEC,
      slug: 'layanan-view-kec',
      name: 'Kecamatan View',
      type: 'kecamatan',
      status: 'published',
    });
    await db.insert(schema.layanans).values([
      {
        id: layananId,
        slug,
        category: 'ambulance',
        name: 'Ambulans View E2E',
        phonesJson: JSON.stringify([{ phone: '08123000001' }]),
        regionId: KEC,
        publishStatus: 'published',
        createdAt: now,
        updatedAt: now,
      },
      {
        id: '01E2ELAYANANVIEWUNPUB001',
        slug: 'layanan-view-unpub',
        category: 'fire',
        name: 'Pemadam Unpublished',
        phonesJson: JSON.stringify([{ phone: '08123000002' }]),
        regionId: KEC,
        publishStatus: 'unpublished',
        createdAt: now,
        updatedAt: now,
      },
    ]);
  });

  const viewBySlug = (headers: Record<string, string> = {}) =>
    request(`/api/v1/layanan/${slug}/view`, {
      method: 'POST',
      body: '{}',
      headers,
    });

  const viewRows = async () => {
    const { getTestDb } = await import('@/shared/database/drizzle/test-client');
    const { layananViews } = await import('@/shared/database/drizzle/schema');
    return getTestDb().select().from(layananViews);
  };

  it('pembaca sama dua kali = 1 baris', async () => {
    const dev = { 'x-device-id': 'layananviewdeviceaaaa' };
    expect((await viewBySlug(dev)).status).toBe(200);
    expect((await viewBySlug(dev)).status).toBe(200);
    expect(
      (await viewRows()).filter((r) => r.layananId === layananId).length,
    ).toBe(1);
  });

  it('admin views + daily', async () => {
    const totals = await get('/api/v1/admin/layanan/views?days=30', adminToken);
    expect(totals.status).toBe(200);
    const totalBody = await totals.json();
    expect(
      totalBody.data.items.some(
        (i: { layanan_id: string }) => i.layanan_id === layananId,
      ),
    ).toBe(true);

    const daily = await get(
      '/api/v1/admin/layanan/views/daily?days=7',
      adminToken,
    );
    expect(daily.status).toBe(200);
    const dailyBody = await daily.json();
    expect(
      dailyBody.data.items.some(
        (i: { layanan_id: string }) => i.layanan_id === layananId,
      ),
    ).toBe(true);
    expect(dailyBody.data.trend).toBeInstanceOf(Array);

    expect((await get('/api/v1/admin/layanan/views')).status).toBe(401);
  });
});