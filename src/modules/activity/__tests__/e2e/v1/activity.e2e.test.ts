import { describe, it, expect, beforeAll } from 'vitest';
import { config } from 'dotenv';
import { eq } from 'drizzle-orm';
import { ANONIM_EMAIL, ANONIM_USER_ID, ANONIM_USERNAME } from '@/shared/constants/anonim';
import { e2eRegisterBody } from '@/shared/testing/e2e-auth';

const { parsed } = config({ path: '.env.test', quiet: true });
const hasTestDb = !!parsed?.DATABASE_URL;
if (parsed?.DATABASE_URL) process.env.DATABASE_URL = parsed.DATABASE_URL;

const ulid26 = (prefix: string) => prefix.padEnd(26, '0').slice(0, 26);

describe.skipIf(!hasTestDb)('Activity feed E2E - GET /api/v1/activity (37)', () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let app: any;

  const request = (path: string, init: RequestInit = {}) =>
    app.request(path, {
      ...init,
      headers: { 'content-type': 'application/json', ...(init.headers ?? {}) },
    });

  const get = (path: string) => request(path);
  const post = (path: string, body: unknown) =>
    request(path, { method: 'POST', body: JSON.stringify(body) });

  beforeAll(async () => {
    const { getTestDb } = await import('@/shared/database/drizzle/test-client');
    const {
      users,
      languages,
      words,
      comments,
      votes,
      searchMisses,
    } = await import('@/shared/database/drizzle/schema');
    const db = getTestDb();
    const { truncateAll } = await import('@/shared/database/drizzle/test-utils');
    await truncateAll(db);

    await db.insert(users).values({
      id: ANONIM_USER_ID,
      username: ANONIM_USERNAME,
      displayName: ANONIM_USERNAME,
      email: ANONIM_EMAIL,
      passwordHash: 'bukan-hash-login',
      role: 'contributor',
    });

    const appModule = await import('@/app');
    app = appModule.app;

    const stamp = Date.now();
    const reg = await post(
      '/api/v1/auth/register',
      e2eRegisterBody({
        name: `act${stamp}`,
        email: `act${stamp}@test.com`,
      }),
    );
    const regBody = await reg.json();
    const userId = regBody.data.user_id as string;
    const username = regBody.data.username as string;

    const [lang] = await db.select().from(languages).limit(1);
    const languageId = lang?.id ?? ulid26('01E2ELANGACT');
    if (!lang) {
      await db.insert(languages).values({
        id: languageId,
        code: 'sbb',
        name: 'Sambas',
      });
    }

    const wordId = ulid26(`01E2EWORD${stamp}`);
    await db.insert(words).values({
      id: wordId,
      lemma: `lemmaact${stamp}`,
      languageId,
      status: 'published',
      isVerified: true,
      verifiedAt: new Date(),
      createdBy: userId,
      wordType: 'word',
    });

    await db.insert(comments).values({
      id: ulid26(`01E2ECMT${stamp}`),
      wordId,
      userId,
      body: 'komentar feed aktivitas',
      status: 'published',
    });

    await db.insert(votes).values({
      id: ulid26(`01E2EVOT${stamp}`),
      userId,
      entityType: 'word',
      entityId: wordId,
      value: 1,
    });

    await db.insert(searchMisses).values({
      id: ulid26(`01E2EMIS${stamp}`),
      term: `missact${stamp}`,
      direction: 'lemma',
      isVisible: true,
      hitCount: 3,
      lastSearchedAt: new Date(),
    });

    // pastikan username ada di DB (register sudah set) + verified supaya welcome masuk
    await db
      .update(users)
      .set({ avatarUrl: null, emailVerified: true })
      .where(eq(users.id, userId));
    void username;

    const login = await post('/api/v1/auth/login', {
      email: `act${stamp}@test.com`,
      password: 'Password123',
    });
    token = ((await login.json()) as { data: { access_token: string } }).data.access_token;
    sharedWordId = wordId;
  });

  let token = '';
  let sharedWordId = '';

  it('POST /words/:id/card-shares: 201 lalu 200 (dedupe 24 jam), muncul di feed', async () => {
    const share = () =>
      request(`/api/v1/words/${sharedWordId}/card-shares`, {
        method: 'POST',
        headers: { authorization: `Bearer ${token}` },
      });
    const first = await share();
    expect(first.status).toBe(201);
    expect((await first.json()).data.recorded).toBe(true);

    const again = await share();
    expect(again.status).toBe(200);
    expect((await again.json()).data.recorded).toBe(false);

    const anon = await request(`/api/v1/words/${sharedWordId}/card-shares`, { method: 'POST' });
    expect(anon.status).toBe(401);

    const feed = await (await get('/api/v1/activity?limit=50')).json();
    const shares = feed.data.filter((i: { kind: string }) => i.kind === 'card_share');
    expect(shares).toHaveLength(1);
    expect(shares[0].body).toMatch(/^Membagikan kartu · lemmaact/);
  });

  it('GET /activity publik 200, tanpa email, search_miss actor null', async () => {
    const res = await get('/api/v1/activity?limit=20');
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      success: boolean;
      data: Array<{
        id: string;
        kind: string;
        actor: { username: string | null; email?: string } | null;
        body: string;
        subtitle: string | null;
      }>;
      meta: { limit: number; next_cursor: string | null; has_more: boolean };
    };
    expect(body.success).toBe(true);
    expect(body.meta.limit).toBe(20);
    expect(typeof body.meta.has_more).toBe('boolean');
    expect(
      body.meta.next_cursor === null || typeof body.meta.next_cursor === 'string',
    ).toBe(true);
    expect(Array.isArray(body.data)).toBe(true);
    expect(body.data.length).toBeGreaterThan(0);

    for (const item of body.data) {
      expect(item).not.toHaveProperty('email');
      if (item.actor) {
        expect(item.actor).not.toHaveProperty('email');
      }
    }

    const miss = body.data.find((i) => i.kind === 'search_miss');
    expect(miss).toBeTruthy();
    expect(miss!.actor).toBeNull();
    expect(miss!.body).toMatch(/Mencari ".+" - belum ada/);

    const vote = body.data.find((i) => i.kind === 'vote');
    expect(vote?.actor?.username).toBeTruthy();

    const welcome = body.data.find((i) => i.kind === 'welcome');
    expect(welcome).toBeTruthy();
    expect(welcome!.body).toBe('Bergabung di SambasKu');
    expect(welcome!.subtitle).toBe('Selamat datang');
    expect(welcome!.actor?.username).toBeTruthy();
  });

  it('welcome diurut dari waktu verifikasi, bukan waktu daftar (#47)', async () => {
    const { getTestDb } = await import('@/shared/database/drizzle/test-client');
    const { users: usersTable } = await import('@/shared/database/drizzle/schema');
    const db = getTestDb();
    const stamp = Date.now();

    // Daftar 10 hari lalu, email baru diverifikasi sekarang.
    const reg = await post(
      '/api/v1/auth/register',
      e2eRegisterBody({ name: `wel${stamp}`, email: `wel${stamp}@test.com` }),
    );
    const regBody = (await reg.json()) as { data: { user_id: string; username: string } };
    const lateUserId = regBody.data.user_id;
    await db
      .update(usersTable)
      .set({
        createdAt: new Date(stamp - 10 * 24 * 60 * 60 * 1000),
        emailVerified: true,
        // +60s: kolom integer ber-granularitas detik; seluruh fixture e2e
        // berjalan < 1 detik sehingga new Date() bisa tie lalu kalah id-sort.
        emailVerifiedAt: new Date(stamp + 60_000),
      })
      .where(eq(usersTable.id, lateUserId));

    // Semua aktivitas lain (kata/komentar/vote/share) berumur < 10 hari:
    // lebih baru dari createdAt user ini tapi lebih lama dari verifikasinya.
    const feed = (await (
      await get('/api/v1/activity?limit=50')
    ).json()) as { data: Array<{ kind: string; actor: { username: string | null } | null }> };
    expect(feed.data[0]?.kind).toBe('welcome');
    expect(feed.data[0]?.actor?.username).toBe(regBody.data.username);
  });

  it('cursor tidak mengulang baris di halaman berikutnya (#47)', async () => {
    const { getTestDb } = await import('@/shared/database/drizzle/test-client');
    const { users: usersTable } = await import('@/shared/database/drizzle/schema');
    const db = getTestDb();
    const base = Date.now();

    // Fixture e2e lain semuanya lahir dalam <1 detik, jadi tidak bisa menguji
    // keyset. Tiga user dengan detik verifikasi berbeda supaya ada "halaman
    // kedua" yang benar-benar lebih lama.
    const seeded: string[] = [];
    for (const [i, offsetSec] of [30, 20, 10].entries()) {
      const reg = await post(
        '/api/v1/auth/register',
        e2eRegisterBody({ name: `cur${base}${i}`, email: `cur${base}${i}@test.com` }),
      );
      const regBody = (await reg.json()) as { data: { user_id: string } };
      await db
        .update(usersTable)
        .set({
          emailVerified: true,
          emailVerifiedAt: new Date(base - offsetSec * 1000),
        })
        .where(eq(usersTable.id, regBody.data.user_id));
      seeded.push(regBody.data.user_id);
    }

    const seen: string[] = [];
    const times: number[] = [];
    let cursor: string | null = null;
    let pages = 0;

    // Terus sampai habis atau 6 halaman (guard kalau ada loop tak berujung).
    do {
      const url: string = `/api/v1/activity?limit=2${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ''}`;
      const body = (await (await get(url)).json()) as {
        success: boolean;
        data: Array<{ id: string; created_at: string }>;
        meta: { next_cursor: string | null; has_more: boolean };
      };
      expect(body.success).toBe(true);
      for (const item of body.data) {
        seen.push(item.id);
        times.push(Date.parse(item.created_at));
      }
      cursor = body.meta.next_cursor;
      pages += 1;
    } while (cursor && pages < 6);

    // Ketiga user 반드시 muncul, dan butuh >1 halaman pada limit 2.
    expect(pages).toBeGreaterThan(1);
    for (const id of seeded) {
      expect(seen).toContain(`welcome:${id}`);
    }
    // Kursor yang terikat milidetik membuat `ts < ms` selalu benar, sehingga
    // setiap halaman mengulang isi halaman sebelumnya.
    expect(new Set(seen).size).toBe(seen.length);
    // Dan tidak boleh ada lompatan waktu ke belakang antar halaman.
    expect(times).toEqual([...times].sort((a, b) => b - a));
  });

  it('setiap created_at dalam rentang waktu yang masuk akal (#47)', async () => {
    const body = (await (await get('/api/v1/activity?limit=50')).json()) as {
      data: Array<{ id: string; created_at: string }>;
    };
    expect(body.data.length).toBeGreaterThan(0);

    const ms = body.data.map((i) => Date.parse(i.created_at));
    for (const [i, t] of ms.entries()) {
      expect(Number.isNaN(t), `${body.data[i]!.id} punya created_at tak bisa diparse`).toBe(false);
      // 1e10 detik = tahun 2286. Di atas itu berarti ada yang menulis epoch ms.
      expect(t / 1000, `${body.data[i]!.id} di luar rentang detik`).toBeLessThan(1e10);
    }
    // Feed harus benar-benar menurun, tidak hanya "semuanya masuk rentang".
    const sorted = [...ms].sort((a, b) => b - a);
    expect(ms).toEqual(sorted);
  });
});
