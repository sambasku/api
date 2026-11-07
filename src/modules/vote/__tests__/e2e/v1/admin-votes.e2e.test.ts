import { describe, it, expect, beforeAll } from 'vitest';
import { config } from 'dotenv';
import { eq } from 'drizzle-orm';
import { e2eRegisterBody } from '@/shared/testing/e2e-auth';

// Pastikan .env.test (DB test) dipakai SEBELUM app di-import (Section 10)
const { parsed } = config({ path: '.env.test', quiet: true });
const hasTestDb = !!parsed?.DATABASE_URL;
if (parsed?.DATABASE_URL) process.env.DATABASE_URL = parsed?.DATABASE_URL;

// Fixture ULID - selalu 26 karakter (varchar(26))
const ulid26 = (prefix: string) => prefix.padEnd(26, '0').slice(0, 26);
const SMB = ulid26('01U2ELANGSMB');
const IDN = ulid26('01U2ELANGIDN');
const NOMINA = ulid26('01U2EWCNOMINA');
const MAKANAN = ulid26('01U2ECATMAKANAN');

function validWordBody(lemma: string) {
  return {
    language_id: SMB,
    lemma,
    meanings: [
      {
        word_class_id: NOMINA,
        definition: 'Kata untuk moderasi vote',
        order_index: 1,
        translations: [{ language_id: IDN, translation_text: 'kata moderasi', translation_type: 'direct' }],
      },
    ],
    word_type: 'word',
    category_ids: [MAKANAN],
    related_words: [],
    status: 'published',
  };
}

describe.skipIf(!hasTestDb)('Admin Votes E2E v1 - moderasi vote (root/admin/reviewer)', () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let app: any;
  let adminToken: string;
  let reviewerToken: string;
  let editorToken: string;
  let voter1Name: string;
  let voter2Name: string;
  let voter1Token: string;
  let voter2Token: string;
  let wordId: string;
  let meaningId: string;

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

  const del = (path: string, token?: string, body?: unknown) =>
    request(path, {
      method: 'DELETE',
      ...(body ? { body: JSON.stringify(body) } : {}),
      headers: token ? { authorization: `Bearer ${token}` } : {},
    });

  beforeAll(async () => {
    const { getTestDb } = await import('@/shared/database/drizzle/test-client');
    const { categories, languages, userRoles, users, wordClasses } = await import('@/shared/database/drizzle/schema');
    const db = getTestDb();
    const { truncateAll } = await import('@/shared/database/drizzle/test-utils');
    await truncateAll(db);

    await db.insert(languages).values([
      { id: SMB, code: 'smb', name: 'Sambas' },
      { id: IDN, code: 'id', name: 'Indonesia' },
    ]);
    await db.insert(wordClasses).values({ id: NOMINA, code: 'n', name: 'Nomina' });
    await db.insert(categories).values({ id: MAKANAN, name: 'Makanan' });

    const appModule = await import('@/app');
    app = appModule.app;

    const stamp = Date.now();
    voter1Name = `vot1${stamp}`;
    voter2Name = `vot2${stamp}`;
    const register = async (name: string) =>
      post(
        '/api/v1/auth/register',
        e2eRegisterBody({ name, email: `${name}@test.com` }),
      );
    await register(`adm${stamp}`);
    await register(`rev${stamp}`);
    await register(`edt${stamp}`);
    await register(voter1Name);
    await register(voter2Name);

    await db.update(users).set({ emailVerified: true });
    const [__uid_105] = await db.select({ id: users.id }).from(users).where(eq(users.email, `adm${stamp}@test.com`)).limit(1);
    if (__uid_105) await db.insert(userRoles).values({ userId: __uid_105.id, role: 'admin' }).onConflictDoNothing();
    const [__uid_107] = await db.select({ id: users.id }).from(users).where(eq(users.email, `rev${stamp}@test.com`)).limit(1);
    if (__uid_107) await db.insert(userRoles).values({ userId: __uid_107.id, role: 'reviewer' }).onConflictDoNothing();
    const [__uid_109] = await db.select({ id: users.id }).from(users).where(eq(users.email, `edt${stamp}@test.com`)).limit(1);
    if (__uid_109) await db.insert(userRoles).values({ userId: __uid_109.id, role: 'editor' }).onConflictDoNothing();

    const login = async (email: string) => {
      const res = await post('/api/v1/auth/login', { email, password: 'Password123' });
      return ((await res.json()) as { data: { access_token: string } }).data.access_token;
    };
    adminToken = await login(`adm${stamp}@test.com`);
    reviewerToken = await login(`rev${stamp}@test.com`);
    editorToken = await login(`edt${stamp}@test.com`);
    voter1Token = await login(`${voter1Name}@test.com`);
    voter2Token = await login(`${voter2Name}@test.com`);

    const create = await post('/api/v1/admin/words', validWordBody('kata dimoderasi'), adminToken);
    const { data } = await create.json();
    wordId = data.word_id as string;

    // 0101: vote word pensiun - seed vote ke makna pertama kata ini.
    const detail = await get(`/api/v1/words/${wordId}`, adminToken);
    const detailBody = (await detail.json()) as { data: { meanings: { id: string }[] } };
    meaningId = detailBody.data.meanings[0]!.id;

    // Seed 2 vote up pada makna yang sama (bahan moderasi)
    for (const token of [voter1Token, voter2Token]) {
      const res = await post('/api/v1/votes', { target_type: 'meaning', target_id: meaningId, value: 1 }, token);
      expect(res.status).toBe(200);
    }
  });

  it('4 endpoint tanpa token → 401', async () => {
    for (const path of ['/api/v1/admin/votes', '/api/v1/admin/votes/top-targets']) {
      expect((await get(path)).status).toBe(401);
    }
    expect((await del(`/api/v1/admin/votes/${ulid26('01NOVOTE')}`)).status).toBe(401);
    expect(
      (await del('/api/v1/admin/votes/reset-target', undefined, {
        target_type: 'word',
        target_id: wordId,
      })).status,
    ).toBe(401);
  });

  it('role editor (di bawah reviewer) → 403', async () => {
    expect((await get('/api/v1/admin/votes', editorToken)).status).toBe(403);
  });

  it('list reviewer: 200 + envelope cursor + TANPA password_hash', async () => {
    const res = await get(`/api/v1/admin/votes?q=${voter1Name}&target_type=meaning&limit=2`, reviewerToken);
    expect(res.status).toBe(200);

    const body = (await res.json()) as {
      success: boolean;
      data: Record<string, unknown>[];
      meta: { limit: number; next_cursor: string | null; has_more: boolean };
    };
    expect(body.success).toBe(true);
    expect(body.meta).toMatchObject({ limit: 2 });
    expect(body.data.length).toBe(1);
    expect(body.data[0]).toMatchObject({
      voter_username: voter1Name,
      target_type: 'meaning',
      target_id: meaningId,
      value: 1,
      // Definisi sungguhan menang atas padanan.
      target_preview: 'kata dimoderasi · Kata untuk moderasi vote',
    });
    // NFR-5: response TIDAK pernah mengandung password_hash
    expect(Object.keys(body.data[0]).includes('password_hash')).toBe(false);
  });

  it('top-targets: 200 + makna seed muncul dengan net=2', async () => {
    const res = await get('/api/v1/admin/votes/top-targets?target_type=meaning&limit=50', reviewerToken);
    expect(res.status).toBe(200);

    const body = (await res.json()) as {
      success: boolean;
      data: {
        target_id: string;
        upvotes: number;
        downvotes: number;
        net: number;
        target_preview: string | null;
      }[];
    };
    expect(body.success).toBe(true);
    const hit = body.data.find((r) => r.target_id === meaningId);
    expect(hit).toMatchObject({
      upvotes: 2,
      downvotes: 0,
      net: 2,
      target_preview: 'kata dimoderasi · Kata untuk moderasi vote',
    });
  });

  it('preview makna placeholder "-" = lemma · padanan, bukan tanda hubung', async () => {
    const create = await post(
      '/api/v1/admin/words',
      {
        ...validWordBody('kalintiak'),
        meanings: [
          {
            word_class_id: NOMINA,
            definition: '-',
            is_have_definition: false,
            order_index: 1,
            translations: [
              { language_id: IDN, translation_text: 'makan', translation_type: 'direct' },
            ],
          },
        ],
      },
      adminToken,
    );
    expect(create.status).toBe(201);
    const created = (await create.json()) as { data: { word_id: string } };
    const detail = await get(`/api/v1/words/${created.data.word_id}`, adminToken);
    const detailBody = (await detail.json()) as { data: { meanings: { id: string }[] } };
    const placeholderMeaningId = detailBody.data.meanings[0]!.id;

    const voted = await post(
      '/api/v1/votes',
      { target_type: 'meaning', target_id: placeholderMeaningId, value: 1 },
      voter2Token,
    );
    expect(voted.status).toBe(200);

    const res = await get(
      `/api/v1/admin/votes?target_id=${placeholderMeaningId}`,
      reviewerToken,
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as { data: { target_preview: string | null }[] };
    expect(body.data[0]?.target_preview).toBe('kalintiak · makan');
  });

  it('GET /admin/words/:wordId/voters: 200 + counts; editor 403; kata fiktif 404', async () => {
    expect((await get(`/api/v1/admin/words/${wordId}/voters`, editorToken)).status).toBe(403);

    const res = await get(`/api/v1/admin/words/${wordId}/voters?limit=10`, reviewerToken);
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      success: boolean;
      data: Record<string, unknown>[];
      meta: {
        limit: number;
        has_more: boolean;
        upvotes: number;
        downvotes: number;
      };
    };
    expect(body.success).toBe(true);
    expect(body.meta).toMatchObject({ limit: 10, upvotes: 2, downvotes: 0, has_more: false });
    expect(body.data).toHaveLength(2);
    expect(body.data.map((v) => v.voter_username).sort()).toEqual([voter1Name, voter2Name].sort());
    expect(body.data.every((v) => v.meaning_id === meaningId)).toBe(true);
    expect(Object.keys(body.data[0]!).includes('password_hash')).toBe(false);

    const filtered = await get(
      `/api/v1/admin/words/${wordId}/voters?meaning_id=${meaningId}&value=1`,
      reviewerToken,
    );
    const filteredBody = (await filtered.json()) as {
      data: { value: number }[];
      meta: { upvotes: number; downvotes: number };
    };
    expect(filtered.status).toBe(200);
    expect(filteredBody.data).toHaveLength(2);
    expect(filteredBody.meta).toMatchObject({ upvotes: 2, downvotes: 0 });

    const miss = await get(`/api/v1/admin/words/${ulid26('01NOWORD')}/voters`, reviewerToken);
    expect(miss.status).toBe(404);
    expect((await miss.json()).error_code).toBe('WORD_NOT_FOUND');
  });

  it('delete vote individual → 200 & vote hilang dari list', async () => {
    const list = await get(`/api/v1/admin/votes?q=${voter1Name}`, reviewerToken);
    const body = (await list.json()) as { data: { id: string; voter_username: string }[] };
    const vote = body.data.find((v) => v.voter_username === voter1Name);
    expect(vote).toBeDefined();

    const res = await del(`/api/v1/admin/votes/${vote!.id}`, reviewerToken);
    expect(res.status).toBe(200);

    const after = await get(`/api/v1/admin/votes?q=${voter1Name}`, reviewerToken);
    const afterBody = (await after.json()) as { data: { voter_username: string }[] };
    expect(afterBody.data.filter((v) => v.voter_username === voter1Name)).toHaveLength(0);
  });

  it('reset-target → 200 & semua vote target terhapus', async () => {
    const res = await del(
      '/api/v1/admin/votes/reset-target',
      reviewerToken,
      { target_type: 'meaning', target_id: meaningId },
    );
    expect(res.status).toBe(200);

    const body = (await res.json()) as { data: { deleted_count: number } };
    expect(body.data.deleted_count).toBe(1); // vote voter1 sudah dihapus test sebelumnya

    const after = await get(`/api/v1/admin/votes?target_id=${meaningId}`, reviewerToken);
    const afterBody = (await after.json()) as { data: unknown[] };
    expect(afterBody.data).toHaveLength(0);
  });
});
