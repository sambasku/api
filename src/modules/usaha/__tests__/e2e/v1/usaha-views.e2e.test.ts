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

describe.skipIf(!hasTestDb)('Usaha views E2E', () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let app: any;
  let adminToken: string;
  const usahaId = '01E2EUSAHAVIEWPUB00000001';
  const slug = 'usaha-view-e2e';

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
      e2eRegisterBody({ name: `uadm${stamp}`, email: `uadm${stamp}@test.com` }),
    );
    await post('/api/v1/auth/verify-email', {
      email: `uadm${stamp}@test.com`,
      code: capturedOtpDisplayCode(),
    });
    const [uid] = await db
      .select({ id: schema.users.id })
      .from(schema.users)
      .where(eq(schema.users.email, `uadm${stamp}@test.com`))
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
          email: `uadm${stamp}@test.com`,
          password: 'Password123',
        })
      ).json()
    ).data.access_token;

    const now = new Date();
    await db.insert(schema.usahas).values([
      {
        id: usahaId,
        slug,
        name: 'Usaha View E2E',
        publishStatus: 'published',
        kind: 'product',
        publishedAt: now,
        createdAt: now,
      },
      {
        id: '01E2EUSAHAVIEWDRAFT000001',
        slug: 'usaha-view-draf',
        name: 'Usaha Draft',
        publishStatus: 'draft',
        kind: 'product',
        createdAt: now,
      },
    ]);
  });

  const viewBySlug = (headers: Record<string, string> = {}) =>
    request(`/api/v1/usaha/${slug}/view`, {
      method: 'POST',
      body: '{}',
      headers,
    });

  const viewRows = async () => {
    const { getTestDb } = await import('@/shared/database/drizzle/test-client');
    const { usahaViews } = await import('@/shared/database/drizzle/schema');
    return getTestDb().select().from(usahaViews);
  };

  it('pembaca sama dua kali = 1 baris', async () => {
    const dev = { 'x-device-id': 'usahaviewdeviceaaaa' };
    expect((await viewBySlug(dev)).status).toBe(200);
    expect((await viewBySlug(dev)).status).toBe(200);
    expect((await viewRows()).filter((r) => r.usahaId === usahaId).length).toBe(
      1,
    );
  });

  it('admin views + daily', async () => {
    const totals = await get('/api/v1/admin/usaha/views?days=30', adminToken);
    expect(totals.status).toBe(200);
    const totalBody = await totals.json();
    expect(
      totalBody.data.items.some(
        (i: { usaha_id: string }) => i.usaha_id === usahaId,
      ),
    ).toBe(true);

    const daily = await get('/api/v1/admin/usaha/views/daily?days=7', adminToken);
    expect(daily.status).toBe(200);
    const dailyBody = await daily.json();
    expect(
      dailyBody.data.items.some(
        (i: { usaha_id: string }) => i.usaha_id === usahaId,
      ),
    ).toBe(true);
    expect(dailyBody.data.trend).toBeInstanceOf(Array);

    expect((await get('/api/v1/admin/usaha/views')).status).toBe(401);
  });
});