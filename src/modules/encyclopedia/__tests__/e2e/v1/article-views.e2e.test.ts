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

describe.skipIf(!hasTestDb)('Article views E2E', () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let app: any;
  let adminToken: string;
  let authorId: string;
  const articleId = '01E2EARTICLEVIEWPUB00001';
  const slug = 'artikel-view-e2e';

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
      e2eRegisterBody({ name: `aadm${stamp}`, email: `aadm${stamp}@test.com` }),
    );
    await post('/api/v1/auth/verify-email', {
      email: `aadm${stamp}@test.com`,
      code: capturedOtpDisplayCode(),
    });
    const [uid] = await db
      .select({ id: schema.users.id })
      .from(schema.users)
      .where(eq(schema.users.email, `aadm${stamp}@test.com`))
      .limit(1);
    authorId = uid!.id;
    if (uid) {
      await db
        .insert(schema.userRoles)
        .values({ userId: uid.id, role: 'admin' })
        .onConflictDoNothing();
    }
    adminToken = (
      await (
        await post('/api/v1/auth/login', {
          email: `aadm${stamp}@test.com`,
          password: 'Password123',
        })
      ).json()
    ).data.access_token;

    const catId = '01E2EARTICLEVIEWCAT0001';
    await db.insert(schema.encyclopediaCategories).values({
      id: catId,
      name: 'Sejarah',
    });
    await db.insert(schema.articles).values({
      id: articleId,
      slug,
      title: 'Artikel View E2E',
      bodyMd: 'Isi.',
      categoryId: catId,
      authorUserId: authorId,
      status: 'published',
      publishedAt: new Date(),
    });
  });

  const viewBySlug = (headers: Record<string, string> = {}) =>
    request(`/api/v1/encyclopedia/articles/${slug}/view`, {
      method: 'POST',
      body: '{}',
      headers,
    });

  const viewRows = async () => {
    const { getTestDb } = await import('@/shared/database/drizzle/test-client');
    const { articleViews } = await import('@/shared/database/drizzle/schema');
    return getTestDb().select().from(articleViews);
  };

  it('pembaca sama dua kali = 1 baris', async () => {
    const dev = { 'x-device-id': 'articleviewdeviceaa' };
    expect((await viewBySlug(dev)).status).toBe(200);
    expect((await viewBySlug(dev)).status).toBe(200);
    expect(
      (await viewRows()).filter((r) => r.articleId === articleId).length,
    ).toBe(1);
  });

  it('admin views + daily', async () => {
    const totals = await get(
      '/api/v1/admin/encyclopedia/views?days=30',
      adminToken,
    );
    expect(totals.status).toBe(200);
    const totalBody = await totals.json();
    expect(
      totalBody.data.items.some(
        (i: { article_id: string }) => i.article_id === articleId,
      ),
    ).toBe(true);

    const daily = await get(
      '/api/v1/admin/encyclopedia/views/daily?days=7',
      adminToken,
    );
    expect(daily.status).toBe(200);
    const dailyBody = await daily.json();
    expect(
      dailyBody.data.items.some(
        (i: { article_id: string }) => i.article_id === articleId,
      ),
    ).toBe(true);
    expect(dailyBody.data.trend).toBeInstanceOf(Array);
  });
});