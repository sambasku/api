import { describe, it, expect, beforeAll } from 'vitest';
import { config } from 'dotenv';
import { sql } from 'drizzle-orm';
import { e2eRegisterBody } from '@/shared/testing/e2e-auth';

// Pastikan .env.test (DB test) dipakai SEBELUM app di-import (Section 10)
const { parsed } = config({ path: '.env.test', quiet: true });
const hasTestDb = !!parsed?.DATABASE_URL;
if (parsed?.DATABASE_URL) process.env.DATABASE_URL = parsed.DATABASE_URL;

const ulid26 = (prefix: string) => prefix.padEnd(26, '0').slice(0, 26);
const SMB = ulid26('01E2ELANGSMB');
const IDN = ulid26('01E2ELANGIDN');
const NOMINA = ulid26('01E2EWCNOMINA');

// #244: edit in-place contoh pending milik sendiri (PATCH /api/v1/examples/:id).
// 03-api-kontribusi-verifikasi.md endpoint 9.
describe.skipIf(!hasTestDb)('Update Example Pending E2E v1 (#244)', () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let app: any;
  let adminToken: string;
  let contributorToken: string;
  let otherContributorToken: string;
  let meaningId: string;
  let pendingExampleId: string;
  let wordId: string;

  const request = (path: string, init: RequestInit = {}) =>
    app.request(path, {
      ...init,
      headers: { 'content-type': 'application/json', ...(init.headers ?? {}) },
    });
  const send = (method: string, path: string, body?: unknown, token?: string) =>
    request(path, {
      method,
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      headers: token ? { authorization: `Bearer ${token}` } : {},
    });
  const post = (path: string, body: unknown, token?: string) => send('POST', path, body, token);
  const patch = (path: string, body: unknown, token?: string) => send('PATCH', path, body, token);
  const get = (path: string, token?: string) => request(path, { headers: token ? { authorization: `Bearer ${token}` } : {} });

  beforeAll(async () => {
    const { getTestDb } = await import('@/shared/database/drizzle/test-client');
    const { languages, userRoles, users, wordClasses } = await import('@/shared/database/drizzle/schema');
    const { truncateAll } = await import('@/shared/database/drizzle/test-utils');
    const db = getTestDb();
    await truncateAll(db);
    await db.insert(languages).values([
      { id: SMB, code: 'smb', name: 'Sambas' },
      { id: IDN, code: 'id', name: 'Indonesia' },
    ]);
    await db.insert(wordClasses).values({ id: NOMINA, code: 'n', name: 'Nomina' });

    const appModule = await import('@/app');
    app = appModule.app;

    const stamp = Date.now();
    for (const [prefix, email, role] of [
      ['adm', `adm${stamp}@test.com`, 'admin'],
      ['kon', `kon${stamp}@test.com`, 'contributor'],
      ['kon2', `kon2${stamp}@test.com`, 'contributor'],
    ] as const) {
      await post('/api/v1/auth/register', e2eRegisterBody({
          name: `${prefix}${stamp}`,
          email: email,
      }));
      if (role !== 'contributor') {
        await db.insert(userRoles).values({ userId: sql`(SELECT id FROM users WHERE email = email)`, role }).onConflictDoNothing();
      }
    }
    await db.update(users).set({ emailVerified: true });
    const login = async (email: string) =>
      (await (await post('/api/v1/auth/login', { email, password: 'Password123' })).json()).data.access_token;
    adminToken = await login(`adm${stamp}@test.com`);
    contributorToken = await login(`kon${stamp}@test.com`);
    otherContributorToken = await login(`kon2${stamp}@test.com`);

    const create = await post(
      '/api/v1/admin/words',
      {
        language_id: SMB,
        lemma: 'makatn',
        word_type: 'word',
        category_ids: [],
        related_words: [],
        meanings: [
          {
            word_class_id: NOMINA,
            definition: 'memasukkan makanan ke mulut',
            order_index: 1,
            translations: [{ language_id: IDN, translation_text: 'makan', translation_type: 'direct' }],
          },
        ],
        status: 'published',
      },
      adminToken,
    );
    wordId = (await create.json()).data.word_id;
    const detail = await get(`/api/v1/words/${wordId}`);
    meaningId = (await detail.json()).data.meanings[0].id;

    // Contoh pending dari contributor (status pending_review - approval gate)
    const add = await post(
      `/api/v1/meanings/${meaningId}/examples`,
      { source_language_id: SMB, source_sentence: 'Kami udah makatn tadu.', target_sentence: 'Kami sudah makan tadu.' },
      contributorToken,
    );
    expect(add.status).toBe(201);
    const addBody = await add.json();
    // Sebagian env resolveChildPublication mengarahkan contributor ke published;
    // test ini butuh baris pending - paksa pending_review lewat DB bila perlu.
    pendingExampleId = addBody.data.id;
    if (addBody.data.status !== 'pending_review') {
      const { examples } = await import('@/shared/database/drizzle/schema');
      await db.update(examples).set({ status: 'pending_review', isVerified: false }).where(sql`id = ${pendingExampleId}`);
    }
  });

  it('pemilik perbaiki typo → 200, teks baru, tetap pending', async () => {
    const res = await patch(
      `/api/v1/examples/${pendingExampleId}`,
      { source_sentence: 'Kami udah makatn tadi.', target_sentence: 'Kami sudah makan tadi.' },
      contributorToken,
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data).toMatchObject({
      id: pendingExampleId,
      source_sentence: 'Kami udah makatn tadi.',
      target_sentence: 'Kami sudah makan tadi.',
      status: 'pending_review',
      is_verified: false,
    });

    const same = await patch(
      `/api/v1/examples/${pendingExampleId}`,
      { source_sentence: 'Kami udah makatn tadi.' },
      contributorToken,
    );
    expect(same.status).toBe(200);
    expect((await same.json()).data.no_changes).toBe(true);
  });

  it('bukan milik sendiri → 404 EXAMPLE_NOT_FOUND; acak → 404', async () => {
    // GET prefill: milik sendiri → 200; orang lain → 404
    const mine = await get(`/api/v1/examples/${pendingExampleId}`, contributorToken);
    expect(mine.status).toBe(200);
    expect((await mine.json()).data).toMatchObject({ id: pendingExampleId, source_sentence: 'Kami udah makatn tadi.' });
    const notMineGet = await get(`/api/v1/examples/${pendingExampleId}`, otherContributorToken);
    expect(notMineGet.status).toBe(404);

    const notMine = await patch(
      `/api/v1/examples/${pendingExampleId}`,
      { source_sentence: 'x' },
      otherContributorToken,
    );
    expect(notMine.status).toBe(404);
    expect((await notMine.json()).error_code).toBe('EXAMPLE_NOT_FOUND');

    const random = await patch(
      `/api/v1/examples/${ulid26('01E2EEXAMPLNGACAK')}`,
      { source_sentence: 'x' },
      contributorToken,
    );
    expect(random.status).toBe(404);
  });

  it('sudah direview → 409 EXAMPLE_ALREADY_REVIEWED; tanpa token → 401', async () => {
    const { examples } = await import('@/shared/database/drizzle/schema');
    const { getTestDb } = await import('@/shared/database/drizzle/test-client');
    await getTestDb().update(examples).set({ status: 'published', isVerified: true }).where(sql`id = ${pendingExampleId}`);

    const reviewed = await patch(
      `/api/v1/examples/${pendingExampleId}`,
      { source_sentence: 'y' },
      contributorToken,
    );
    expect(reviewed.status).toBe(409);
    expect((await reviewed.json()).error_code).toBe('EXAMPLE_ALREADY_REVIEWED');

    const noToken = await patch(`/api/v1/examples/${pendingExampleId}`, { source_sentence: 'y' });
    expect(noToken.status).toBe(401);
  });

  it('GET /examples/by-word/:wordId → daftar pending milik sendiri saja', async () => {
    const { examples } = await import('@/shared/database/drizzle/schema');
    const { getTestDb } = await import('@/shared/database/drizzle/test-client');
    // Kembalikan ke pending supaya masuk daftar.
    await getTestDb().update(examples).set({ status: 'pending_review', isVerified: false }).where(sql`id = ${pendingExampleId}`);

    const mine = await get(`/api/v1/examples/by-word/${wordId}`, contributorToken);
    expect(mine.status).toBe(200);
    const ids = (await mine.json()).data.map((e: { id: string }) => e.id);
    expect(ids).toContain(pendingExampleId);

    const other = await get(`/api/v1/examples/by-word/${wordId}`, otherContributorToken);
    expect(other.status).toBe(200);
    expect((await other.json()).data).toHaveLength(0);

    const noToken = await get(`/api/v1/examples/by-word/${wordId}`);
    expect(noToken.status).toBe(401);
  });
});
