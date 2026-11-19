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

/**
 * G6 word_views: 1 pembaca unik / lemma / hari WIB.
 * POST /words/:id/view + /lemma/:lemma/view; admin /views + /views/daily.
 */
describe.skipIf(!hasTestDb)('Word views E2E (G6)', () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let app: any;
  let adminToken: string;
  const wordId = '01E2EWORDVIEWPUB0000000001';
  const lemma = 'makatnview';

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
      e2eRegisterBody({ name: `wadm${stamp}`, email: `wadm${stamp}@test.com` }),
    );
    await post('/api/v1/auth/verify-email', {
      email: `wadm${stamp}@test.com`,
      code: capturedOtpDisplayCode(),
    });
    const [uid] = await db
      .select({ id: schema.users.id })
      .from(schema.users)
      .where(eq(schema.users.email, `wadm${stamp}@test.com`))
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
          email: `wadm${stamp}@test.com`,
          password: 'Password123',
        })
      ).json()
    ).data.access_token;

    await db.insert(schema.languages).values({
      id: '01E2ELANGWVIEW00000000001',
      code: 'sbb',
      name: 'Sambas',
    });
    await db.insert(schema.words).values([
      {
        id: wordId,
        lemma,
        languageId: '01E2ELANGWVIEW00000000001',
        status: 'published',
        isVerified: true,
        wordType: 'word',
        createdBy: uid?.id,
      },
      {
        id: '01E2EWORDVIEWDRAFT00000001',
        lemma: 'drafview',
        languageId: '01E2ELANGWVIEW00000000001',
        status: 'draft',
        isVerified: false,
        wordType: 'word',
        createdBy: uid?.id,
      },
    ]);
  });

  const viewById = (headers: Record<string, string> = {}) =>
    request(`/api/v1/words/${wordId}/view`, {
      method: 'POST',
      body: '{}',
      headers,
    });

  const viewRows = async () => {
    const { getTestDb } = await import('@/shared/database/drizzle/test-client');
    const { wordViews } = await import('@/shared/database/drizzle/schema');
    return getTestDb().select().from(wordViews);
  };

  it('refresh pembaca sama = 1 baris; device lain = baris baru', async () => {
    const devA = { 'x-device-id': 'worddeviceaaaaaaaa' };
    for (let i = 0; i < 3; i++) expect((await viewById(devA)).status).toBe(200);
    expect((await viewRows()).filter((r) => r.wordId === wordId).length).toBe(1);

    expect(
      (await viewById({ 'x-device-id': 'worddevicebbbbbbbb' })).status,
    ).toBe(200);
    expect((await viewRows()).filter((r) => r.wordId === wordId).length).toBe(2);
  });

  it('lemma view + draft/id asing = no-op 200', async () => {
    const before = (await viewRows()).length;
    expect(
      (
        await request(`/api/v1/words/lemma/${encodeURIComponent(lemma)}/view`, {
          method: 'POST',
          body: '{}',
          headers: { 'x-device-id': 'worddeviceaaaaaaaa' },
        })
      ).status,
    ).toBe(200);
    // Device A sudah punya baris hari ini → tetap same count untuk wordId.
    expect((await viewRows()).filter((r) => r.wordId === wordId).length).toBe(2);

    expect(
      (
        await request('/api/v1/words/01E2EWORDVIEWDRAFT00000001/view', {
          method: 'POST',
          body: '{}',
          headers: { 'x-device-id': 'worddevicecccccccc' },
        })
      ).status,
    ).toBe(200);
    expect(
      (
        await request('/api/v1/words/01E2EWORDVIEWMISSING000001/view', {
          method: 'POST',
          body: '{}',
        })
      ).status,
    ).toBe(200);
    expect((await viewRows()).length).toBe(before);
  });

  it('admin views + daily', async () => {
    const totals = await get('/api/v1/admin/words/views?days=30', adminToken);
    expect(totals.status).toBe(200);
    const totalBody = await totals.json();
    expect(totalBody.data.items.some((i: { word_id: string }) => i.word_id === wordId)).toBe(
      true,
    );

    const daily = await get('/api/v1/admin/words/views/daily?days=7', adminToken);
    expect(daily.status).toBe(200);
    const dailyBody = await daily.json();
    expect(dailyBody.data.items.some((i: { word_id: string }) => i.word_id === wordId)).toBe(
      true,
    );
    expect(dailyBody.data.trend).toBeInstanceOf(Array);

    expect((await get('/api/v1/admin/words/views')).status).toBe(401);
  });
});
