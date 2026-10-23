import { describe, it, expect, beforeAll } from 'vitest';
import { config } from 'dotenv';
import { eq } from 'drizzle-orm';
import { capturedOtpDisplayCode, e2eRegisterBody } from '@/shared/testing/e2e-auth';

// Pastikan .env.test (DB test) dipakai SEBELUM app di-import
const { parsed } = config({ path: '.env.test', quiet: true });
const hasTestDb = !!parsed?.DATABASE_URL;
if (parsed?.DATABASE_URL) process.env.DATABASE_URL = parsed.DATABASE_URL;

const ulid26 = (prefix: string) => prefix.padEnd(26, '0').slice(0, 26);
const SMB = ulid26('01E2ELANGSMB');
const IDN = ulid26('01E2ELANGIDN');
const NOMINA = ulid26('01E2EWCNOMINA');

// PRD relasi-lemma: moderasi status-baru. contributor → pending_review;
// verifikator (admin/editor/root/reviewer) → published langsung.
describe.skipIf(!hasTestDb)('Word group E2E v1 - kelompok makna + moderasi (PRD relasi-lemma)', () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let app: any;
  let adminToken: string;
  let contributorToken: string;

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
  const patch = (path: string, body: unknown, token?: string) =>
    request(path, {
      method: 'PATCH',
      body: JSON.stringify(body),
      headers: token ? { authorization: `Bearer ${token}` } : {},
    });
  const del = (path: string, token?: string) =>
    request(path, {
      method: 'DELETE',
      headers: token ? { authorization: `Bearer ${token}` } : {},
    });

  beforeAll(async () => {
    const { getTestDb } = await import('@/shared/database/drizzle/test-client');
    const { languages, userRoles, users, wordClasses } = await import(
      '@/shared/database/drizzle/schema'
    );
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

    // Admin (verifikator: published langsung)
    const stamp = Date.now();
    await post(
      '/api/v1/auth/register',
      e2eRegisterBody({ name: `adm${stamp}`, email: `adm${stamp}@test.com` }),
    );
    await post('/api/v1/auth/verify-email', {
      email: `adm${stamp}@test.com`,
      code: capturedOtpDisplayCode(),
    });
    const [uid] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, `adm${stamp}@test.com`))
      .limit(1);
    if (uid) await db.insert(userRoles).values({ userId: uid.id, role: 'admin' }).onConflictDoNothing();
    adminToken = (
      (await (await post('/api/v1/auth/login', { email: `adm${stamp}@test.com`, password: 'Password123' })).json())
        .data
    ).access_token;

    // Contributor (pending_review)
    const cstamp = stamp + 1;
    await post(
      '/api/v1/auth/register',
      e2eRegisterBody({ name: `ctr${cstamp}`, email: `ctr${cstamp}@test.com` }),
    );
    await post('/api/v1/auth/verify-email', {
      email: `ctr${cstamp}@test.com`,
      code: capturedOtpDisplayCode(),
    });
    contributorToken = (
      (await (await post('/api/v1/auth/login', { email: `ctr${cstamp}@test.com`, password: 'Password123' })).json())
        .data
    ).access_token;
  });

  const wordBody = (lemma: string) => ({
    language_id: SMB,
    lemma,
    meanings: [
      {
        word_class_id: NOMINA,
        definition: `definisi ${lemma}`,
        order_index: 1,
        translations: [{ language_id: IDN, translation_text: lemma, translation_type: 'direct' }],
      },
    ],
    word_type: 'word',
    related_words: [],
    status: 'published',
  });

  let groupId = '';
  let wordId1 = '';
  let wordId2 = '';

  it('contributor buat kelompok → pending_review; admin buat → published', async () => {
    // Kata acuan via admin (published) - id diambil dari respons create.
    const w1 = await post('/api/v1/admin/words', wordBody('burak'), adminToken);
    expect(w1.status).toBe(201);
    wordId1 = (await w1.json()).data.word_id;

    const pub = await get('/api/v1/word-groups');
    expect(pub.status).toBe(200);
    expect((await pub.json()).data.items).toEqual([]);

    const byContributor = await post(
      '/api/v1/word-groups',
      { name: 'Jagung (kelompok uji contributor)' },
      contributorToken,
    );
    expect(byContributor.status).toBe(200);
    expect((await byContributor.json()).data.status).toBe('pending_review');

    const byAdmin = await post(
      '/api/v1/word-groups',
      { name: 'Jagung (kelompok uji admin)' },
      adminToken,
    );
    expect(byAdmin.status).toBe(200);
    const group = (await byAdmin.json()).data;
    expect(group.status).toBe('published');
    expect(group.is_verified).toBe(true);
    groupId = group.id;
  });

  it('kelompok pending_review tidak tampil publik; published tampil', async () => {
    const pub = await get('/api/v1/word-groups');
    const names = ((await pub.json()).data.items as { name: string }[]).map((g) => g.name);
    expect(names).toContain('Jagung (kelompok uji admin)');
    expect(names).not.toContain('Jagung (kelompok uji contributor)');
  });

  it('admin tambah anggota → 200; anggota duplikat → 409', async () => {
    const add = await post(
      `/api/v1/word-groups/by-id/members?id=${groupId}`,
      { word_id: wordId1 },
      adminToken,
    );
    expect(add.status).toBe(200);
    const members = ((await add.json()).data.members as { word_id: string }[]).map((m) => m.word_id);
    expect(members).toContain(wordId1);

    const dup = await post(
      `/api/v1/word-groups/by-id/members?id=${groupId}`,
      { word_id: wordId1 },
      adminToken,
    );
    expect(dup.status).toBe(409);
  });

  it('word_id tidak dikenal → 404 WORD_NOT_FOUND; remove member lalu 404 kalau diulang', async () => {
    const unknown = await post(
      `/api/v1/word-groups/by-id/members?id=${groupId}`,
      { word_id: ulid26('01UNKNOWNWORD000000000') },
      adminToken,
    );
    expect(unknown.status).toBe(404);
    expect((await unknown.json()).error_code).toBe('WORD_NOT_FOUND');

    const res = await post('/api/v1/admin/words', wordBody('tempah'), adminToken);
    expect(res.status).toBe(201);
    wordId2 = (await res.json()).data.word_id;

    const add = await post(
      `/api/v1/word-groups/by-id/members?id=${groupId}`,
      { word_id: wordId2 },
      adminToken,
    );
    expect(add.status).toBe(200);
    const rm = await del(
      `/api/v1/word-groups/by-id/members?id=${groupId}&word_id=${wordId2}`,
      adminToken,
    );
    expect(rm.status).toBe(200);
    const rmAgain = await del(
      `/api/v1/word-groups/by-id/members?id=${groupId}&word_id=${wordId2}`,
      adminToken,
    );
    expect(rmAgain.status).toBe(404);

    // Re-add setelah keluar harus sukses (revive baris soft-deleted),
    // bukan 409 UNIQUE (edgecase: pernah keluar lalu mau masuk lagi).
    const reAdd = await post(
      `/api/v1/word-groups/by-id/members?id=${groupId}`,
      { word_id: wordId2 },
      adminToken,
    );
    expect(reAdd.status).toBe(200);
    const reMembers = ((await reAdd.json()).data.members as { word_id: string }[]).map(
      (m) => m.word_id,
    );
    expect(reMembers).toContain(wordId2);
  });

  it('endpoint publik hanya menampilkan anggota published dari kata published', async () => {
    // Anggota pending_review: kata published tapi keanggotaan belum tayang.
    const w3 = await post('/api/v1/admin/words', wordBody('selodang'), adminToken);
    const wordId3 = (await w3.json()).data.word_id;
    const memberPending = await post(
      `/api/v1/word-groups/by-id/members?id=${groupId}`,
      { word_id: wordId3, status: 'pending_review' },
      adminToken,
    );
    expect(memberPending.status).toBe(200);

    const publicOne = await get(`/api/v1/word-groups/by-id?id=${groupId}`);
    expect(publicOne.status).toBe(200);
    const publicIds = ((await publicOne.json()).data.members as { word_id: string }[]).map(
      (m) => m.word_id,
    );
    expect(publicIds).not.toContain(wordId3);

    // Endpoint admin tetap melihat yang pending (antrean moderasi).
    const adminOne = await get(`/api/v1/word-groups/all/by-id?id=${groupId}`, adminToken);
    const adminIds = ((await adminOne.json()).data.members as { word_id: string }[]).map(
      (m) => m.word_id,
    );
    expect(adminIds).toContain(wordId3);
  });

  it('update nama/status → 200; soft-delete kelompok → hilang dari list', async () => {
    const upd = await patch(
      `/api/v1/word-groups/by-id?id=${groupId}`,
      { description: 'Kelompok uji e2e' },
      adminToken,
    );
    expect(upd.status).toBe(200);
    expect((await upd.json()).data.description).toBe('Kelompok uji e2e');

    // Buat grup buang untuk dihapus
    const created = await post('/api/v1/word-groups', { name: 'Grup buang' }, adminToken);
    const throwaway = (await created.json()).data.id;
    const delRes = await del(`/api/v1/word-groups/by-id?id=${throwaway}`, adminToken);
    expect(delRes.status).toBe(200);
    const gone = await get(`/api/v1/word-groups/by-id?id=${throwaway}`);
    expect(gone.status).toBe(404);
  });
});
