import { describe, it, expect, beforeAll } from 'vitest';
import { config } from 'dotenv';
import { eq } from 'drizzle-orm';
import { ANONIM_EMAIL, ANONIM_USER_ID, ANONIM_USERNAME } from '@/shared/constants/anonim';
import { e2eRegisterBody } from '@/shared/testing/e2e-auth';

const { parsed } = config({ path: '.env.test', quiet: true });
const hasTestDb = !!parsed?.DATABASE_URL;
if (parsed?.DATABASE_URL) process.env.DATABASE_URL = parsed.DATABASE_URL;

const ulid26 = (prefix: string) => prefix.padEnd(26, '0').slice(0, 26);

/**
 * #193: filter kategori chips feed beranda.
 *
 * Yang dikunci di batas HTTP (bukan unit): kinds benar-benar menyaring,
 * `all` identik dengan tanpa param, exclude-self tetap berlaku DI DALAM
 * kategori (AND, bukan OR), dan pagination per kategori tidak menduplikasi.
 */
describe.skipIf(!hasTestDb)('Activity feed kategori #193 - GET /api/v1/activity?category=', () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let app: any;
  let userId = '';
  let token = '';
  let adminId = '';
  let adminToken = '';

  const request = (path: string, init: RequestInit = {}) =>
    app.request(path, {
      ...init,
      headers: { 'content-type': 'application/json', ...(init.headers ?? {}) },
    });
  const get = (path: string, headers: Record<string, string> = {}) =>
    request(path, { headers });

  beforeAll(async () => {
    const { getTestDb } = await import('@/shared/database/drizzle/test-client');
    const { users, languages, words, searchMisses, activityEvents } =
      await import('@/shared/database/drizzle/schema');
    const db = getTestDb();
    const { truncateAll } = await import('@/shared/database/drizzle/test-utils');
    await truncateAll(db);

    await db.insert(users).values({
      id: ANONIM_USER_ID,
      username: ANONIM_USERNAME,
      displayName: ANONIM_USERNAME,
      email: ANONIM_EMAIL,
      passwordHash: 'bukan-hash-login',
    });

    const appModule = await import('@/app');
    app = appModule.app;

    const stamp = Date.now();
    const langId = ulid26(`01E2ELANG${stamp}`);
    await db.insert(languages).values({ id: langId, code: 'sbb', name: 'Sambas' });

    const wordId = ulid26(`01E2EWORD${stamp}`);
    const now = Date.now();

    // User biasa via register API (hash password dari app, bukan dummy).
    const regBody = e2eRegisterBody({
      name: 'Cat User',
      email: `cat${stamp}@test.com`,
    });
    const reg = await request('/api/v1/auth/register', {
      method: 'POST',
      body: JSON.stringify(regBody),
    });
    const regJson = (await reg.json()) as {
      data: { user_id: string; username: string };
    };
    userId = regJson.data.user_id;

    // Verifikasi email manual DULU (login menolak email belum verified).
    await db
      .update(users)
      .set({ emailVerified: true, emailVerifiedAt: new Date() })
      .where(eq(users.id, userId));

    token = (
      (await (
        await request('/api/v1/auth/login', {
          method: 'POST',
          body: JSON.stringify({
            email: regBody.email,
            password: regBody.password,
          }),
        })
      ).json()) as { data: { access_token: string } }
    ).data.access_token;

    // Admin via register lalu promosi role (hash valid supaya bisa login).
    const adminRegBody = e2eRegisterBody({
      name: 'Cat Admin',
      email: `catadmin${stamp}@test.com`,
    });
    const adminReg = await request('/api/v1/auth/register', {
      method: 'POST',
      body: JSON.stringify(adminRegBody),
    });
    const adminRegJson = (await adminReg.json()) as {
      data: { user_id: string; username: string };
    };
    adminId = adminRegJson.data.user_id;
    await db
      .update(users)
      .set({
        emailVerified: true,
        emailVerifiedAt: new Date(),
        roles: '["admin"]',
      })
      .where(eq(users.id, adminId));
    adminToken = (
      (await (
        await request('/api/v1/auth/login', {
          method: 'POST',
          body: JSON.stringify({
            email: adminRegBody.email,
            password: adminRegBody.password,
          }),
        })
      ).json()) as { data: { access_token: string } }
    ).data.access_token;

    await db.insert(words).values({
      id: wordId,
      lemma: `katakata${stamp}`,
      languageId: langId,
      status: 'published',
      isVerified: true,
      verifiedAt: new Date(),
      createdBy: userId,
      wordType: 'word',
    });
    const missId = ulid26(`01E2EMIS${stamp}`);
    await db.insert(searchMisses).values({
      id: missId,
      term: `misscat${stamp}`,
      direction: 'lemma',
      isVisible: true,
      hitCount: 1,
      lastSearchedAt: new Date(),
    });

    // Fixture: 6 event, 2 per kategori yang diuji + 2 kind "all"-only.
    // occurred_at menurun supaya urutan deterministik.
    const at = (i: number) => new Date(now - i * 1000);
    await db.insert(activityEvents).values([
      // announcement x2 (satu milik admin = uji exception #167)
      {
        kind: 'announcement',
        actorId: adminId,
        targetWordId: null,
        targetId: ulid26(`01E2EANN${stamp}`),
        occurredAt: at(0),
        dedupeKey: `ann:admin:${stamp}`,
        payload: JSON.stringify({ title: 'Admin', body: 'dari admin', bodyType: 'plain' }),
      },
      {
        kind: 'announcement',
        actorId: ANONIM_USER_ID,
        targetWordId: null,
        targetId: ulid26(`01E2EANB${stamp}`),
        occurredAt: at(1),
        dedupeKey: `ann:lain:${stamp}`,
        payload: JSON.stringify({ title: 'Lain', body: 'dari lain', bodyType: 'plain' }),
      },
      // joined x2
      {
        kind: 'user_joined',
        actorId: userId,
        targetWordId: null,
        targetId: userId,
        occurredAt: at(2),
        dedupeKey: `joined:cat:${stamp}`,
      },
      {
        kind: 'user_joined',
        actorId: adminId,
        targetWordId: null,
        targetId: adminId,
        occurredAt: at(3),
        dedupeKey: `joined:admin:${stamp}`,
      },
      // search_miss x2
      {
        kind: 'search_miss',
        actorId: null,
        targetWordId: null,
        targetId: missId,
        occurredAt: at(4),
        dedupeKey: `miss:a:${stamp}`,
      },
      {
        kind: 'search_miss',
        actorId: null,
        targetWordId: null,
        targetId: missId,
        occurredAt: at(5),
        dedupeKey: `miss:b:${stamp}`,
      },
      // kind yang TIDAK boleh muncul di ketiga kategori di atas
      {
        kind: 'word_verified',
        actorId: userId,
        targetWordId: wordId,
        targetId: wordId,
        occurredAt: at(6),
        dedupeKey: `verified:${stamp}`,
        payload: 'Memverifikasi kata',
      },
      {
        kind: 'contribution_image',
        actorId: userId,
        targetWordId: wordId,
        targetId: wordId,
        occurredAt: at(7),
        dedupeKey: `image:${stamp}`,
        payload: 'Menambah foto',
      },
    ]);
  });

  const kindsOf = (data: Array<{ kind: string }>) => data.map((i) => i.kind);

  it('category=announcement hanya announcement', async () => {
    const body = (await (await get('/api/v1/activity?limit=50&category=announcement')).json()) as {
      data: Array<{ kind: string }>;
    };
    expect(body.data.length).toBeGreaterThan(0);
    expect(new Set(kindsOf(body.data))).toEqual(new Set(['announcement']));
  });

  it('category=joined hanya welcome (wire kind user_joined)', async () => {
    const body = (await (await get('/api/v1/activity?limit=50&category=joined')).json()) as {
      data: Array<{ kind: string }>;
    };
    expect(body.data.length).toBeGreaterThan(0);
    expect(new Set(kindsOf(body.data))).toEqual(new Set(['welcome']));
  });

  it('category=search_miss hanya search_miss', async () => {
    const body = (await (await get('/api/v1/activity?limit=50&category=search_miss')).json()) as {
      data: Array<{ kind: string }>;
    };
    expect(body.data.length).toBeGreaterThan(0);
    expect(new Set(kindsOf(body.data))).toEqual(new Set(['search_miss']));
  });

  it('category=correction memuat kontribusi media, bukan kata/verifikasi', async () => {
    const body = (await (await get('/api/v1/activity?limit=50&category=correction')).json()) as {
      data: Array<{ kind: string }>;
    };
    const kinds = kindsOf(body.data);
    expect(kinds).toContain('word_image');
    expect(kinds).not.toContain('word');
    expect(kinds).not.toContain('verification');
    expect(kinds).not.toContain('announcement');
  });

  it('category=all identik dengan tanpa param', async () => {
    const [withAll, withoutParam] = await Promise.all([
      get('/api/v1/activity?limit=50&category=all').then((r) => r.json()),
      get('/api/v1/activity?limit=50').then((r) => r.json()),
    ]);
    expect(withAll.data.map((i: { id: string }) => i.id)).toEqual(
      withoutParam.data.map((i: { id: string }) => i.id),
    );
  });

  it('category tidak dikenal -> 400 (bukan diam-diam all)', async () => {
    const res = await get('/api/v1/activity?category=nope');
    expect(res.status).toBe(400);
  });

  // #167 x #193: exclude-self berlaku DI DALAM kategori (AND kinds).
  it('viewer login: baris sendiri dibuang di dalam kategori, pengumuman admin tetap', async () => {
    const body = (await (
      await get('/api/v1/activity?limit=50&category=joined', {
        authorization: `Bearer ${token}`,
      })
    ).json()) as { data: Array<{ kind: string; actor: { username: string | null } | null }> };

    expect(body.data.length).toBeGreaterThan(0);
    expect(new Set(kindsOf(body.data))).toEqual(new Set(['welcome']));
    // user_joined milik viewer sendiri (actorId = userId) tersaring.
    const ownUsername = (await (
      await get('/api/v1/users/me', { authorization: `Bearer ${token}` })
    ).json()) as { data?: { username?: string } };
    const username = ownUsername.data?.username ?? '';
    expect(body.data.every((i) => i.actor?.username !== username)).toBe(true);
  });

  it('admin login: pengumuman sendiri tetap tampil di category=announcement (#167)', async () => {
    if (!adminToken) return; // seed admin tidak selalu bisa login di test db
    const body = (await (
      await get('/api/v1/activity?limit=50&category=announcement', {
        authorization: `Bearer ${adminToken}`,
      })
    ).json()) as { data: Array<{ kind: string; actor: { username: string | null } | null }> };

    expect(new Set(kindsOf(body.data))).toEqual(new Set(['announcement']));
    const adminMe = (await (
      await get('/api/v1/users/me', { authorization: `Bearer ${adminToken}` })
    ).json()) as { data?: { username?: string } };
    const adminUsername = adminMe.data?.username ?? '';
    // Exception #167: announcement buatan sendiri TIDAK di-exclude.
    expect(body.data.some((i) => i.actor?.username === adminUsername)).toBe(true);
  });

  // Pagination per kategori: cursor dibangun dari item terakhir halaman
  // TERFILTER, jadi tidak menduplikasi dan tetap sesuai kategori.
  it('pagination per kategori: tanpa duplikat, semua sesuai kind', async () => {
    const seen: string[] = [];
    let cursor: string | null = null;
    let pages = 0;
    do {
      const url = `/api/v1/activity?limit=1&category=search_miss${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ''}`;
      const body = (await (await get(url)).json()) as {
        data: Array<{ id: string; kind: string }>;
        meta: { next_cursor: string | null };
      };
      for (const item of body.data) seen.push(item.id);
      cursor = body.meta.next_cursor;
      pages += 1;
    } while (cursor && pages < 5);

    expect(pages).toBeGreaterThan(1);
    expect(new Set(seen).size).toBe(seen.length);
  });
});
