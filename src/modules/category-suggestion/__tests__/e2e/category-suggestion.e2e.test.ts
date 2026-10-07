import { describe, it, expect, beforeAll } from 'vitest';
import { config } from 'dotenv';
import { capturedOtpDisplayCode, e2eRegisterBody } from '@/shared/testing/e2e-auth';
import { eq } from 'drizzle-orm';

// Pastikan .env.test (DB test) dipakai SEBELUM app di-import (Section 10)
const { parsed } = config({ path: '.env.test', quiet: true });
const hasTestDb = !!parsed?.DATABASE_URL;
if (parsed?.DATABASE_URL) process.env.DATABASE_URL = parsed.DATABASE_URL;

describe.skipIf(!hasTestDb)('Category Suggestion E2E - usulan kategori termoderasi (api#50)', () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let app: any;
  let adminToken: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let db: any;
  // Poin rate limit publik 3/jam per IP: 3 POST anonim pertama untuk alur
  // fungsional, POST ke-4 wajib 429 (test di paling bawah).
  let anonPosts = 0;

  const request = (path: string, init: RequestInit = {}) =>
    app.request(path, {
      ...init,
      headers: { 'content-type': 'application/json', ...(init.headers ?? {}) },
    });
  const post = (path: string, body: unknown, token?: string) =>
    request(path, {
      method: 'POST',
      body: JSON.stringify(body),
      headers: token ? { authorization: 'Bearer ' + token } : {},
    });
  const patch = (path: string, body: unknown, token?: string) =>
    request(path, {
      method: 'PATCH',
      body: JSON.stringify(body),
      headers: token ? { authorization: 'Bearer ' + token } : {},
    });
  const get = (path: string, token?: string) =>
    request(path, { headers: token ? { authorization: 'Bearer ' + token } : {} });

  const proposeAnon = (body: unknown) => {
    anonPosts++;
    return post('/api/v1/category-suggestions', body);
  };

  beforeAll(async () => {
    const { getTestDb } = await import('@/shared/database/drizzle/test-client');
    const { categories, languages, userRoles, users } = await import(
      '@/shared/database/drizzle/schema'
    );
    const { truncateAll } = await import('@/shared/database/drizzle/test-utils');
    db = getTestDb();
    await truncateAll(db);
    await db.insert(languages).values([{ id: '01E2ELANGSMB00000000000001', code: 'smb', name: 'Sambas' }]);
    // Master bawaan utk test duplikat case-insensitive.
    await db.insert(categories).values({ name: 'Binatang & Hewan' });

    const appModule = await import('@/app');
    app = appModule.app;

    const stamp = Date.now();
    await post(
      '/api/v1/auth/register',
      e2eRegisterBody({ name: `rev${stamp}`, email: `rev${stamp}@test.com` }),
    );
    await post('/api/v1/auth/verify-email', {
      email: `rev${stamp}@test.com`,
      code: capturedOtpDisplayCode(),
    });
    const [row] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, `rev${stamp}@test.com`))
      .limit(1);
    if (row) await db.insert(userRoles).values({ userId: row.id, role: 'reviewer' }).onConflictDoNothing();
    adminToken = (
      (await (
        await post('/api/v1/auth/login', {
          email: `rev${stamp}@test.com`,
          password: 'Password123',
        })
      ).json()).data as { access_token: string }
    ).access_token;
  });

  it('anonim boleh usul (201) - selalu pending, atribusi contributor_name', async () => {
    const res = await proposeAnon({
      name: 'Permainan',
      reason: 'Galah, sapai, gasing',
      contributor_name: 'warga',
    });
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data).toMatchObject({
      name: 'Permainan',
      status: 'pending',
      proposed_by: null,
      contributor_name: 'warga',
    });
    expect(body.data.id).toBeTruthy();
  });

  it('duplikat case-insensitive dengan master aktif → 409 CATEGORY_EXISTS', async () => {
    const res = await proposeAnon({ name: 'binatang & hewan' });
    expect(res.status).toBe(409);
    expect((await res.json()).error_code).toBe('CATEGORY_EXISTS');
  });

  it('admin list: 401 tanpa token, antrean berisi pending dengan token', async () => {
    const tanpaToken = await get('/api/v1/admin/category-suggestions');
    expect(tanpaToken.status).toBe(401);

    const res = await get('/api/v1/admin/category-suggestions?status=pending', adminToken);
    expect(res.status).toBe(200);
    const items = (await res.json()).data as Array<{ name: string; status: string }>;
    expect(items.some((i) => i.name === 'Permainan' && i.status === 'pending')).toBe(true);
  });

  it('reviewer approve → usulan approved + kategori masuk master', async () => {
    const { categories } = await import('@/shared/database/drizzle/schema');
    const list = await (
      await get('/api/v1/admin/category-suggestions?status=pending', adminToken)
    ).json();
    const target = (list.data as Array<{ id: string; name: string }>).find(
      (i) => i.name === 'Permainan',
    );
    expect(target).toBeTruthy();

    const res = await patch(
      `/api/v1/admin/category-suggestions/${target!.id}/review`,
      { action: 'approve' },
      adminToken,
    );
    expect(res.status).toBe(200);
    expect((await res.json()).data).toMatchObject({ status: 'approved' });

    const master = await db
      .select({ name: categories.name })
      .from(categories)
      .where(eq(categories.name, 'Permainan'))
      .limit(1);
    expect(master).toHaveLength(1);
  });

  it('reviewer reject wajib alasan - tidak masuk master', async () => {
    const { categories } = await import('@/shared/database/drizzle/schema');
    // POST anonim ke-2 (kuota rate limit: poin 2 dari 3).
    const propose = await proposeAnon({ name: 'Kesenian', contributor_name: 'warga' });
    expect(propose.status).toBe(201);
    const id = (await propose.json()).data.id as string;

    const tanpaAlasan = await patch(
      `/api/v1/admin/category-suggestions/${id}/review`,
      { action: 'reject' },
      adminToken,
    );
    expect(tanpaAlasan.status).toBe(400);

    const res = await patch(
      `/api/v1/admin/category-suggestions/${id}/review`,
      { action: 'reject', reject_reason: 'sudah tercakup budaya' },
      adminToken,
    );
    expect(res.status).toBe(200);
    expect((await res.json()).data).toMatchObject({
      status: 'rejected',
      reject_reason: 'sudah tercakup budaya',
    });

    const master = await db
      .select({ name: categories.name })
      .from(categories)
      .where(eq(categories.name, 'Kesenian'))
      .limit(1);
    expect(master).toHaveLength(0);
  });

  it('review dua kali → 409 CATEGORY_SUGGESTION_ALREADY_REVIEWED', async () => {
    const list = await (
      await get('/api/v1/admin/category-suggestions?status=approved', adminToken)
    ).json();
    const target = (list.data as Array<{ id: string; name: string }>).find(
      (i) => i.name === 'Permainan',
    );
    expect(target).toBeTruthy();

    const res = await patch(
      `/api/v1/admin/category-suggestions/${target!.id}/review`,
      { action: 'approve' },
      adminToken,
    );
    expect(res.status).toBe(409);
    expect((await res.json()).error_code).toBe('CATEGORY_SUGGESTION_ALREADY_REVIEWED');
  });

  it('filter ?category= (id/nama) + word_count di /categories (1c)', async () => {
    const { categories, words, wordCategories, users } = await import(
      '@/shared/database/drizzle/schema'
    );
    // Seed: 1 kata published berkategori "Binatang & Hewan" + 1 kata bebas.
    const [cat] = await db
      .select({ id: categories.id })
      .from(categories)
      .where(eq(categories.name, 'Binatang & Hewan'))
      .limit(1);
    const [author] = await db.select({ id: users.id }).from(users).limit(1);
    const wordId = '01E2ECATTESTWORD0000000001';
    const freeId = '01E2ECATTESTWORD0000000002';
    await db.insert(words).values([
      {
        id: wordId,
        lemma: 'kucil',
        languageId: '01E2ELANGSMB00000000000001',
        status: 'published',
        isVerified: true,
        verifiedAt: new Date(),
        createdBy: author!.id,
        wordType: 'word',
      },
      {
        id: freeId,
        lemma: 'zabur',
        languageId: '01E2ELANGSMB00000000000001',
        status: 'published',
        isVerified: true,
        verifiedAt: new Date(),
        createdBy: author!.id,
        wordType: 'word',
      },
    ]);
    await db.insert(wordCategories).values({ wordId, categoryId: cat!.id });

    // 1. Filter by nama (case-insensitive, mengandung spasi/&).
    const byName = await get('/api/v1/words?category=' + encodeURIComponent('binatang & hewan'));
    expect(byName.status).toBe(200);
    const nameItems = (await byName.json()).data as Array<{ id: string }>;
    expect(nameItems.map((w) => w.id)).toEqual([wordId]);

    // 2. Filter by id.
    const byId = await get(`/api/v1/words?category=${cat!.id}`);
    expect(byId.status).toBe(200);
    expect(((await byId.json()).data as Array<{ id: string }>).map((w) => w.id)).toEqual([wordId]);

    // 3. Tanpa filter → kedua kata tayang.
    const tanpaFilter = await get('/api/v1/words?limit=100');
    const semua = (await tanpaFilter.json()).data as Array<{ id: string }>;
    expect(semua.some((w) => w.id === wordId)).toBe(true);
    expect(semua.some((w) => w.id === freeId)).toBe(true);

    // 4. word_count di /categories (1 query, subquery count).
    const cats = await get('/api/v1/categories');
    expect(cats.status).toBe(200);
    const catList = (await cats.json()).data as Array<{ name: string; word_count: number }>;
    expect(catList.find((c) => c.name === 'Binatang & Hewan')?.word_count).toBe(1);
    expect(catList.every((c) => typeof c.word_count === 'number')).toBe(true);
  });

  it('rate limit publik: POST anonim ke-4 dalam 1 jam → 429', async () => {
    // Poin dipakai: 1 (Permainan) + 1 (duplikat) + 1 (Kesenian) = 3/3.
    const res = await proposeAnon({ name: 'Nada', contributor_name: 'warga' });
    expect(anonPosts).toBe(4);
    expect(res.status).toBe(429);
  });
});
