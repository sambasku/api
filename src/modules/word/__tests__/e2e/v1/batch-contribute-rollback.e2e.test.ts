import { describe, it, expect, beforeAll } from 'vitest';
import { config } from 'dotenv';
import { eq } from 'drizzle-orm';
import { capturedOtpDisplayCode, e2eRegisterBody } from '@/shared/testing/e2e-auth';
import { ANONIM_EMAIL, ANONIM_USER_ID, ANONIM_USERNAME } from '@/shared/constants/anonim';

const { parsed } = config({ path: '.env.test', quiet: true });
const hasTestDb = !!parsed?.DATABASE_URL;
if (parsed?.DATABASE_URL) process.env.DATABASE_URL = parsed.DATABASE_URL;

const ulid26 = (prefix: string) => prefix.padEnd(26, '0').slice(0, 26);
const SBS = ulid26('01E2BATCHLANGSBS');
const IDN = ulid26('01E2BATCHLANGIDN');
const UMUM = ulid26('01E2BATCHWCUMUM');

describe.skipIf(!hasTestDb)('Batch contribute + import session rollback E2E', () => {
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
  const get = (path: string, token?: string) =>
    request(path, { headers: token ? { authorization: `Bearer ${token}` } : {} });

  beforeAll(async () => {
    const { getTestDb } = await import('@/shared/database/drizzle/test-client');
    const { dialects, languages, userRoles, users, wordClasses } = await import('@/shared/database/drizzle/schema');
    const { truncateAll } = await import('@/shared/database/drizzle/test-utils');
    const db = getTestDb();
    await truncateAll(db);
    await db.insert(languages).values([
      { id: SBS, code: 'SBS', name: 'Sambas' },
      { id: IDN, code: 'IDN', name: 'Indonesia' },
    ]);
    await db.insert(dialects).values({
      id: ulid26('01E2BATCHDIALUMUM'),
      languageId: SBS,
      code: 'umum',
      name: 'Umum',
      isDefault: true,
    });
    await db.insert(wordClasses).values({ id: UMUM, code: 'umum', name: 'Umum' });

    const appModule = await import('@/app');
    app = appModule.app;

    const stamp = Date.now();
    const email = `adm-batch${stamp}@test.com`;
    await post('/api/v1/auth/register', e2eRegisterBody({ name: `admbatch${stamp}`, email }));
    await post('/api/v1/auth/verify-email', { email, code: capturedOtpDisplayCode() });
    const [__uid_62] = await db.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1);
    if (__uid_62) await db.insert(userRoles).values({ userId: __uid_62.id, role: 'admin' }).onConflictDoNothing();

    await db.insert(users).values({
      id: ANONIM_USER_ID,
      username: ANONIM_USERNAME,
      displayName: ANONIM_USERNAME,
      email: ANONIM_EMAIL,
      passwordHash: 'bukan-hash-login',
    });

    adminToken = (
      await (
        await post('/api/v1/auth/login', { email, password: 'Password123' })
      ).json()
    ).data.access_token;
  });

  it('batch anon → published + session; rollback soft-delete; idempotent', async () => {
    // Angka panjang di lemma kena heuristik "terlalu banyak simbol atau angka".
    const lemma = 'lemabatche2erollback';
    const create = await post('/api/v1/contributions/words/batch', {
      contributor_name: 'Penutur E2E',
      rows: [{ sambas: lemma, indonesia: 'arti batch' }],
    });
    expect(create.status).toBe(201);
    const body = await create.json();
    expect(body.data.created_count).toBe(1);
    expect(body.data.session_id).toBeTruthy();
    const wordId = body.data.items[0]?.word_id as string;
    expect(wordId).toBeTruthy();

    // Langsung tayang
    const pub = await get(`/api/v1/words/${wordId}`);
    expect(pub.status).toBe(200);
    expect((await pub.json()).data.lemma).toBe(lemma);

    const session = await get(
      `/api/v1/admin/words/import-sessions/${body.data.session_id}`,
      adminToken,
    );
    expect(session.status).toBe(200);
    const sessionBody = await session.json();
    expect(sessionBody.data.support_name).toBe('Penutur E2E');
    expect(sessionBody.data.source_label).toBe('Kontribusi massal web');
    expect(sessionBody.data.rolled_back_at).toBeNull();

    const rollback = await post(
      `/api/v1/admin/words/import-sessions/${body.data.session_id}/rollback`,
      {},
      adminToken,
    );
    expect(rollback.status).toBe(200);
    const rollbackBody = await rollback.json();
    expect(rollbackBody.data.deleted_count).toBe(1);
    expect(rollbackBody.data.session.rolled_back_at).toBeTruthy();

    expect((await get(`/api/v1/words/${wordId}`)).status).toBe(404);

    const again = await post(
      `/api/v1/admin/words/import-sessions/${body.data.session_id}/rollback`,
      {},
      adminToken,
    );
    expect(again.status).toBe(200);
    expect((await again.json()).data.deleted_count).toBe(0);
  });
});
