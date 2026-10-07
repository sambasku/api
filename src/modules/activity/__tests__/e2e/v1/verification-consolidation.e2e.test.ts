import { describe, it, expect, beforeAll } from 'vitest';
import { config } from 'dotenv';
import { eq } from 'drizzle-orm';
import { ANONIM_EMAIL, ANONIM_USER_ID, ANONIM_USERNAME } from '@/shared/constants/anonim';
import { capturedOtpDisplayCode, e2eRegisterBody } from '@/shared/testing/e2e-auth';

// Pastikan .env.test (DB test) dipakai SEBELUM app di-import (Section 10).
const { parsed } = config({ path: '.env.test', quiet: true });
const hasTestDb = !!parsed?.DATABASE_URL;
if (parsed?.DATABASE_URL) process.env.DATABASE_URL = parsed.DATABASE_URL;

const ulid26 = (prefix: string) => prefix.padEnd(26, '0').slice(0, 26);

// #56: approve kontribusi kata baru harusnya menghasilkan TEPAT 1 baris
// feed home ("Memverifikasi usulan B: lemma") - usulan lama superseded.
describe.skipIf(!hasTestDb)('Verification feed consolidation - #56', () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let app: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let db: any;
  let lemma: string;
  let reviewerToken: string;
  let contributorUsername: string;

  const request = (path: string, init: RequestInit = {}) =>
    app.request(path, {
      ...init,
      headers: { 'content-type': 'application/json', ...(init.headers ?? {}) },
    });
  const get = (path: string, token?: string) =>
    request(path, token ? { headers: { authorization: 'Bearer ' + token } } : {});
  const post = (path: string, body: unknown, token?: string) =>
    request(path, {
      method: 'POST',
      body: JSON.stringify(body),
      headers: token ? { authorization: 'Bearer ' + token } : {},
    });

  beforeAll(async () => {
    const { getTestDb } = await import('@/shared/database/drizzle/test-client');
    const { users, languages } = await import('@/shared/database/drizzle/schema');
    db = getTestDb();
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
    const [lang] = await db.select().from(languages).limit(1);
    const languageId = lang?.id ?? ulid26('01E2ELANGACT');
    if (!lang) {
      await db.insert(languages).values({ id: languageId, code: 'sbb', name: 'Sambas' });
    }

    // Reviewer (approve) + kontributor (pengusul).
    const { userRoles } = await import('@/shared/database/drizzle/schema');
    const registerVerified = async (name: string, email: string) => {
      const reg = await post('/api/v1/auth/register', e2eRegisterBody({ name, email }));
      expect(reg.status).toBe(201);
      const verify = await post('/api/v1/auth/verify-email', {
        email,
        code: capturedOtpDisplayCode(),
      });
      expect(verify.status).toBe(200);
      return (await reg.json()).data as { user_id: string; username: string };
    };
    const login = async (email: string) => {
      const res = await post('/api/v1/auth/login', { email, password: 'Password123' });
      expect(res.status).toBe(200);
      return ((await res.json()).data.access_token) as string;
    };

    const revEmail = `rev${stamp}@test.com`;
    const rev = await registerVerified(`rev${stamp}`, revEmail);
    await db.insert(userRoles).values({ userId: rev.user_id, role: 'reviewer' });
    reviewerToken = await login(revEmail);

    const conEmail = `con${stamp}@test.com`;
    const con = await registerVerified(`con${stamp}`, conEmail);
    contributorUsername = con.username;
    const contributorToken = await login(conEmail);

    // Kontributor mengusulkan kata baru: POST /api/v1/contributions/words
    // (login, non-verifikator) → pending_review + contribution_submitted.
    lemma = `konsolusi${stamp}`;
    const { wordClasses } = await import('@/shared/database/drizzle/schema');
    let [wc] = await db.select().from(wordClasses).limit(1);
    if (!wc) {
      const wcId = ulid26(`01E2EWC${stamp}`);
      await db.insert(wordClasses).values({ id: wcId, code: 'n', name: 'Nomina' });
      [wc] = await db.select().from(wordClasses).limit(1);
    }
    const propose = await post(
      '/api/v1/contributions/words',
      {
        language_id: languageId,
        lemma,
        meanings: [{ definition: 'uji konsolidasi', word_class_id: wc.id }],
        word_type: 'word',
        category_ids: [],
        related_words: [],
      },
      contributorToken,
    );
    if (propose.status !== 201) throw new Error('propose gagal: ' + JSON.stringify(await propose.json()));
  }, 60_000);

  it('approve kontribusi kata baru → feed home TEPAT 1 row verifikasi, usulan superseded', async () => {
    const { activityEvents } = await import('@/shared/database/drizzle/schema');

    // Antrean review admin: cari usulan lemma ini.
    const listBody = await (await get('/api/v1/admin/contributions?status=pending', reviewerToken)).json();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const target = (listBody.data as any[]).find(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (c: any) => JSON.stringify(c.payload ?? c).includes(lemma),
    );
    expect(target, `usulan ${lemma} harus ada di antrean: ` + JSON.stringify(listBody).slice(0, 300)).toBeTruthy();

    const approve = await post(`/api/v1/admin/contributions/${target.id}/approve`, {}, reviewerToken);
    expect(approve.status).toBeLessThan(300);

    // Feed home: tepat 1 row utk lemma, berkind verification.
    const feedRes = await get('/api/v1/activity?limit=50');
    const feed = await feedRes.json();
    if (!Array.isArray(feed.data)) throw new Error('feed error: ' + feedRes.status + ' ' + JSON.stringify(feed).slice(0, 300));
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rows = (feed.data as any[]).filter((it: any) => it.body?.includes(lemma));
    expect(rows.length).toBe(1);
    expect(rows[0].kind).toBe('verification');
    // Copy #2: "Memverifikasi usulan {B}: lemma".
    expect(rows[0].body).toBe(`Memverifikasi usulan ${contributorUsername}: ${lemma}`);

    // Event store: usulan lama superseded (bukan hidden/delete).
    const verifEvents = await db.select().from(activityEvents).where(eq(activityEvents.kind, 'word_verified'));
    expect(verifEvents.length).toBe(1);
    expect(verifEvents[0].supersededAt).toBeNull();
    const superseded = await db
      .select()
      .from(activityEvents)
      .where(eq(activityEvents.kind, 'contribution_submitted'));
    expect(superseded.length).toBe(1);
    expect(superseded[0].supersededAt).not.toBeNull();
  });

  it('profil kontributor: riwayat usulan TETAP tayang (kredit utuh)', async () => {
    const profileRes = await get(`/api/v1/users/${contributorUsername}/activity?limit=50`);
    const profile = await profileRes.json();
    const profileItems = (profile.data as { items?: unknown[] })?.items ?? profile.data;
    if (!Array.isArray(profileItems)) throw new Error('profile error: ' + profileRes.status + ' ' + JSON.stringify(profile).slice(0, 300));
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rows = (profileItems as any[]).filter((it: any) =>
      it.summary?.includes(lemma) || it.body?.includes(lemma),
    );
    expect(rows.length).toBeGreaterThan(0);
  });
});
