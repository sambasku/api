import { describe, it, expect, beforeAll } from 'vitest';
import { config } from 'dotenv';
import { eq } from 'drizzle-orm';
import { ANONIM_EMAIL, ANONIM_USER_ID, ANONIM_USERNAME } from '@/shared/constants/anonim';
import { e2eRegisterBody } from '@/shared/testing/e2e-auth';

const { parsed } = config({ path: '.env.test', quiet: true });
const hasTestDb = !!parsed?.DATABASE_URL;
if (parsed?.DATABASE_URL) process.env.DATABASE_URL = parsed.DATABASE_URL;

const ulid26 = (prefix: string) => prefix.padEnd(26, '0').slice(0, 26);

describe.skipIf(!hasTestDb)('Public profile E2E v1 - GET /users/:username (19 doc)', () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let app: any;
  let reviewerUsername: string;
  let contributorUsername: string;
  let stamp: number;

  const request = (path: string, init: RequestInit = {}) =>
    app.request(path, {
      ...init,
      headers: { 'content-type': 'application/json', ...(init.headers ?? {}) },
    });

  const post = (path: string, body: unknown) =>
    request(path, { method: 'POST', body: JSON.stringify(body) });

  const get = (path: string) => request(path);

  beforeAll(async () => {
    const { getTestDb } = await import('@/shared/database/drizzle/test-client');
    const { users, contributions, contributionReviews, votes, words } =
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
      role: 'contributor',
    });

    const appModule = await import('@/app');
    app = appModule.app;

    stamp = Date.now();
    reviewerUsername = `rev${stamp}`;
    contributorUsername = `kon${stamp}`;

    const revRes = await post('/api/v1/auth/register', e2eRegisterBody({
        name: reviewerUsername,
        email: `rev${stamp}@test.com`,
    }));
    const konRes = await post('/api/v1/auth/register', e2eRegisterBody({
        name: contributorUsername,
        email: `kon${stamp}@test.com`,
    }));
    const revBody = await revRes.json();
    const konBody = await konRes.json();
    const reviewerId = revBody.data.user_id as string;
    const contributorId = konBody.data.user_id as string;

    await db.update(users).set({ role: 'reviewer' }).where(eq(users.id, reviewerId));

    const contributionId = ulid26(`01E2ECON${stamp}`);
    await db.insert(contributions).values({
      id: contributionId,
      userId: contributorId,
      entityType: 'word',
      entityId: ulid26('01E2EWORDPROF'),
      action: 'create',
      status: 'approved',
    });
    await db.insert(contributionReviews).values({
      contributionId,
      reviewerId,
      status: 'approved',
    });

    // Kata feed-visible + vote: item `vote` harus muncul di aktivitas publik.
    const { languages } = await import('@/shared/database/drizzle/schema');
    const [lang] = await db.select().from(languages).limit(1);
    const languageId = lang?.id ?? ulid26('01E2ELANGPROF');
    if (!lang) {
      await db
        .insert(languages)
        .values({ id: languageId, code: 'sbb', name: 'Sambas' });
    }
    const wordId = ulid26(`01E2EWORD${stamp}`);
    await db.insert(words).values({
      id: wordId,
      lemma: `lemmaprof${stamp}`,
      languageId,
      status: 'published',
      isVerified: true,
      verifiedAt: new Date(),
      createdBy: reviewerId,
      wordType: 'word',
    });
    // Downvote contributor: harus keluar summary "perlu dicek ulang".
    await db.insert(votes).values({
      id: ulid26(`01E2EVOT${stamp}`),
      userId: contributorId,
      entityType: 'word',
      entityId: wordId,
      value: -1,
    });
    // Insert 3 more votes untuk test pagination (limit=1 butuh 4 item → 3 halaman, halaman 2 has_more=false).
    for (let i = 1; i <= 3; i++) {
      const wId = ulid26(`01E2EWORD${stamp}V${i}`);
      await db.insert(words).values({
        id: wId,
        lemma: `lemmaprof${stamp}v${i}`,
        languageId,
        status: 'published',
        isVerified: true,
        verifiedAt: new Date(),
        createdBy: reviewerId,
        wordType: 'word',
      });
      await db.insert(votes).values({
        id: ulid26(`01E2EVOT${stamp}V${i}`),
        userId: contributorId,
        entityType: 'word',
        entityId: wId,
        value: 1,
      });
    }
  });

  it('GET /api/v1/users/anonim → 200, is_verifier false, stats 0', async () => {
    const res = await get(`/api/v1/users/${ANONIM_USERNAME}`);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data).toMatchObject({
      username: 'anonim',
      display_name: 'anonim',
      bio: null,
      role: 'contributor',
      is_verifier: false,
      stats: { contributions_approved: 0, verifications_done: 0, comments_published: 0 },
    });
    expect(body.data.joined_at).toBeTruthy();
    expect(body.data).toHaveProperty('avatar_url');
    expect(body.data).not.toHaveProperty('email');
    expect(body.data).not.toHaveProperty('phone');
  });

  it('GET reviewer → is_verifier true + verifications_done >= 1', async () => {
    const res = await get(`/api/v1/users/${reviewerUsername}`);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.username).toBe(reviewerUsername);
    expect(body.data.role).toBe('reviewer');
    expect(body.data.is_verifier).toBe(true);
    expect(body.data.stats.verifications_done).toBe(1);
    expect(body.data.stats.contributions_approved).toBe(0);
  });

  it('GET contributor → is_verifier false + contributions_approved >= 1', async () => {
    const res = await get(`/api/v1/users/${contributorUsername}`);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.is_verifier).toBe(false);
    expect(body.data.stats.contributions_approved).toBe(1);
  });

  it('GET /users/:username/activity → 200, max 20, bentuk item publik', async () => {
    const res = await get(`/api/v1/users/${contributorUsername}/activity`);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body.data.items)).toBe(true);
    expect(body.data.items.length).toBeLessThanOrEqual(20);
    expect(body.data.items.length).toBeGreaterThanOrEqual(1);
    const item = body.data.items[0];
    expect(item).toMatchObject({
      kind: expect.stringMatching(
        /^(contribution|comment|verification|vote)$/,
      ),
      occurred_at: expect.any(String),
      summary: expect.any(String),
    });
    expect(item).toHaveProperty('word_id');
    expect(item).toHaveProperty('lemma');
    expect(item).not.toHaveProperty('user_id');
    expect(item).not.toHaveProperty('email');
  });

  it('GET /users/:username/activity → vote downvote contributor muncul', async () => {
    const res = await get(`/api/v1/users/${contributorUsername}/activity`);
    expect(res.status).toBe(200);
    const body = await res.json();
    // Cari vote dengan lemma asli (downvote) - bukan yang di-insert untuk pagination.
    const vote = body.data.items.find(
      (entry: { kind: string; lemma: string }) =>
        entry.kind === 'vote' && entry.lemma === `lemmaprof${stamp}`,
    );
    expect(vote).toBeTruthy();
    expect(vote.summary).toContain('"');
    expect(vote.summary).toMatch(/perlu dicek ulang$/);
    expect(vote.lemma).toBe(`lemmaprof${stamp}`);
    expect(vote.word_id).toBeTruthy();
  });

  it('GET /users/:username/activity?kind=vote&limit=1 → meta cursor + halaman 2', async () => {
    // Halaman 1
    const res1 = await get(
      `/api/v1/users/${contributorUsername}/activity?kind=vote&limit=1`,
    );
    expect(res1.status).toBe(200);
    const body1 = await res1.json();
    expect(body1.data.items).toHaveLength(1);
    expect(body1.meta).toMatchObject({
      limit: 1,
      next_cursor: expect.any(String),
      has_more: true,
    });
    const cursor1 = body1.meta.next_cursor;
    expect(cursor1).toBeTruthy();

    // Halaman 2 pakai cursor (ada 4 total vote → halaman 2 masih has_more=true)
    const res2 = await get(
      `/api/v1/users/${contributorUsername}/activity?kind=vote&limit=1&cursor=${cursor1}`,
    );
    expect(res2.status).toBe(200);
    const body2 = await res2.json();
    expect(body2.data.items).toHaveLength(1);
    expect(body2.meta.has_more).toBe(true); // 4 total, limit=1 → page 2 of 4
    expect(body2.meta.next_cursor).toBeTruthy();

    // Tidak duplikat
    expect(body2.data.items[0].id).not.toBe(body1.data.items[0].id);
  });

  it('GET /users/:username/activity?kind=comment → filter kind', async () => {
    const res = await get(
      `/api/v1/users/${contributorUsername}/activity?kind=comment`,
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.items.length).toBeGreaterThanOrEqual(0);
    for (const item of body.data.items) {
      expect(item.kind).toBe('comment');
    }
    expect(body.meta).toBeDefined();
  });

  it('GET /users/:username/activity?kind=contribution → filter kind', async () => {
    const res = await get(
      `/api/v1/users/${contributorUsername}/activity?kind=contribution`,
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    for (const item of body.data.items) {
      expect(item.kind).toBe('contribution');
    }
    expect(body.meta).toBeDefined();
  });

  it('GET username acak → 404 USER_NOT_FOUND', async () => {
    const res = await get('/api/v1/users/tidakada999');
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error_code).toBe('USER_NOT_FOUND');
  });
});
