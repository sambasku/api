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

    // pastikan username ada di DB (register sudah set)
    await db.update(users).set({ avatarUrl: null }).where(eq(users.id, userId));
    void username;
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
      }>;
      meta: { limit: number };
    };
    expect(body.success).toBe(true);
    expect(body.meta.limit).toBe(20);
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
    expect(miss!.body).toMatch(/mencari .+ Bantu isi/);

    const vote = body.data.find((i) => i.kind === 'vote');
    expect(vote?.actor?.username).toBeTruthy();
  });
});
