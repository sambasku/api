import { describe, it, expect, beforeAll } from 'vitest';
import { config } from 'dotenv';
import {
  capturedOtpDisplayCode,
  e2eRegisterBody,
} from '@/shared/testing/e2e-auth';
import { and, eq } from 'drizzle-orm';

const { parsed } = config({ path: '.env.test', quiet: true });
const hasTestDb = !!parsed?.DATABASE_URL;
if (parsed?.DATABASE_URL) process.env.DATABASE_URL = parsed.DATABASE_URL;

describe.skipIf(!hasTestDb)('Article claps notif E2E (#345)', () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let app: any;
  let authorId: string;
  let clapperA: { id: string; token: string };
  let clapperB: { id: string; token: string };
  const articleId = '01E2EARTICLECLAPPUB0000001';
  const slug = 'artikel-clap-e2e';

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
  const setClaps = (count: number, token: string) =>
    request(`/api/v1/encyclopedia/articles/${articleId}/claps`, {
      method: 'PUT',
      body: JSON.stringify({ count }),
      headers: { authorization: `Bearer ${token}` },
    });

  const makeUser = async (tag: string, email: string) => {
    const { getTestDb } = await import('@/shared/database/drizzle/test-client');
    const schema = await import('@/shared/database/drizzle/schema');
    await post('/api/v1/auth/register', e2eRegisterBody({ name: tag, email }));
    await post('/api/v1/auth/verify-email', {
      email,
      code: capturedOtpDisplayCode(),
    });
    const [row] = await getTestDb()
      .select({ id: schema.users.id })
      .from(schema.users)
      .where(eq(schema.users.email, email))
      .limit(1);
    const login = await (
      await post('/api/v1/auth/login', { email, password: 'Password123' })
    ).json();
    return { id: row!.id, token: login.data.access_token as string };
  };

  beforeAll(async () => {
    const { getTestDb } = await import('@/shared/database/drizzle/test-client');
    const schema = await import('@/shared/database/drizzle/schema');
    const { truncateAll } = await import('@/shared/database/drizzle/test-utils');
    const db = getTestDb();
    await truncateAll(db);

    const appModule = await import('@/app');
    app = appModule.app;

    const stamp = Date.now();
    const author = await makeUser(`aut${stamp}`, `aut${stamp}@test.com`);
    authorId = author.id;
    clapperA = await makeUser(`cla${stamp}`, `cla${stamp}@test.com`);
    clapperB = await makeUser(`clb${stamp}`, `clb${stamp}@test.com`);

    const catId = '01E2EARTICLECLAPCAT000001';
    await db.insert(schema.encyclopediaCategories).values({
      id: catId,
      name: 'Sejarah',
    });
    await db.insert(schema.articles).values({
      id: articleId,
      slug,
      title: 'Artikel Clap E2E',
      bodyMd: 'Isi.',
      categoryId: catId,
      authorUserId: authorId,
      status: 'published',
      publishedAt: new Date(),
    });
  });

  const articleClapRows = async () => {
    const { getTestDb } = await import('@/shared/database/drizzle/test-client');
    const { notifications } = await import('@/shared/database/drizzle/schema');
    return getTestDb()
      .select()
      .from(notifications)
      .where(
        and(
          eq(notifications.userId, authorId),
          eq(notifications.type, 'article_clap'),
        ),
      );
  };

  it('clap berulang dari user yang sama = tetap 1 baris inbox', async () => {
    expect((await setClaps(1, clapperA.token)).status).toBe(200);
    expect((await setClaps(2, clapperA.token)).status).toBe(200);
    expect((await setClaps(3, clapperA.token)).status).toBe(200);

    const rows = await articleClapRows();
    expect(rows.length).toBe(1);
    expect(rows[0]!.targetId).toBe(`${articleId}:${clapperA.id}`);
    expect(rows[0]!.actionValue).toBe(slug);
  });

  it('clapper berbeda = baris inbox terpisah', async () => {
    expect((await setClaps(1, clapperB.token)).status).toBe(200);

    const targets = (await articleClapRows()).map((r) => r.targetId).sort();
    expect(targets).toEqual(
      [`${articleId}:${clapperA.id}`, `${articleId}:${clapperB.id}`].sort(),
    );
  });

  it('tarik ke 0 lalu clap lagi = tidak menambah baris', async () => {
    expect((await setClaps(0, clapperA.token)).status).toBe(200);
    expect((await setClaps(2, clapperA.token)).status).toBe(200);

    expect((await articleClapRows()).length).toBe(2);
  });
});
