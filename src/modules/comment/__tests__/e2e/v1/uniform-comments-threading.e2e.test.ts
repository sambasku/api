import { describe, it, expect, beforeAll } from 'vitest';
import { config } from 'dotenv';
import { eq } from 'drizzle-orm';
import { e2eRegisterBody } from '@/shared/testing/e2e-auth';

const { parsed } = config({ path: '.env.test', quiet: true });
const hasTestDb = !!parsed?.DATABASE_URL;
if (parsed?.DATABASE_URL) process.env.DATABASE_URL = parsed.DATABASE_URL;

const ulid26 = (prefix: string) => prefix.padEnd(26, '0').slice(0, 26);
const SMB = ulid26('01T2ELANGSMB');
const IDN = ulid26('01T2ELANGIDN');
const NOMINA = ulid26('01T2EWCNOMINA');
const MAKANAN = ulid26('01T2ECATMAKANAN');
const PLACE_ID = ulid26('01T2EPLACE001');

describe.skipIf(!hasTestDb)('Uniform 2-level comments E2E (#375)', () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let app: any;
  let adminToken: string;
  let userToken: string;
  let wordId: string;

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

  const patch = (path: string, body: unknown, token?: string) =>
    request(path, {
      method: 'PATCH',
      body: JSON.stringify(body),
      headers: token ? { authorization: `Bearer ${token}` } : {},
    });

  const get = (path: string, token?: string) =>
    request(path, { headers: token ? { authorization: `Bearer ${token}` } : {} });

  beforeAll(async () => {
    const { getTestDb } = await import('@/shared/database/drizzle/test-client');
    const { users, languages, wordClasses, categories, userRoles, places } = await import(
      '@/shared/database/drizzle/schema'
    );
    const { truncateAll } = await import('@/shared/database/drizzle/test-utils');
    const db = getTestDb();
    await truncateAll(db);
    const appModule = await import('@/app');
    app = appModule.app;

    await db.insert(languages).values([
      { id: SMB, code: 'smb', name: 'Sambas' },
      { id: IDN, code: 'id', name: 'Indonesia' },
    ]);
    await db.insert(wordClasses).values({ id: NOMINA, code: 'n', name: 'Nomina' });
    await db.insert(categories).values({ id: MAKANAN, name: 'Makanan' });

    await post(
      '/api/v1/auth/register',
      e2eRegisterBody({ name: 'threadadmin', email: 'thread_admin@test.com' }),
    );
    await post(
      '/api/v1/auth/register',
      e2eRegisterBody({ name: 'threaduser', email: 'thread_user@test.com' }),
    );
    await db.update(users).set({ emailVerified: true });
    const [adminRow] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, 'thread_admin@test.com'))
      .limit(1);
    const adminId = adminRow!.id;
    await db.insert(userRoles).values({ userId: adminId, role: 'admin' }).onConflictDoNothing();

    const loginAdmin = await post('/api/v1/auth/login', {
      email: 'thread_admin@test.com',
      password: 'Password123',
    });
    adminToken = (await loginAdmin.json()).data.access_token;

    const loginUser = await post('/api/v1/auth/login', {
      email: 'thread_user@test.com',
      password: 'Password123',
    });
    userToken = (await loginUser.json()).data.access_token;

    const createWord = await post(
      '/api/v1/admin/words',
      {
        language_id: SMB,
        lemma: 'kata berbalas',
        meanings: [
          {
            word_class_id: NOMINA,
            definition: 'uji 2-level komentar',
            order_index: 1,
            translations: [{ language_id: IDN, translation_text: 'kata uji', translation_type: 'direct' }],
          },
        ],
        category_ids: [MAKANAN],
        status: 'published',
      },
      adminToken,
    );
    const createWordJson = await createWord.json();
    wordId = (createWordJson.data?.id ??
      createWordJson.data?.word_id ??
      createWordJson.data?.word?.id) as string;

    await db.insert(places).values({
      id: PLACE_ID,
      slug: 'pantai-uji-thread',
      name: 'Pantai Uji Thread',
      category: 'pantai',
      shortDescription: 'Pantai untuk uji komentar 2-level',
      status: 'published',
      authorId: adminId,
    });
  });

  it('word comments: 2-level nesting + rejects reply-to-reply (1-level cap)', async () => {
    const rRoot = await post(`/api/v1/words/${wordId}/comments`, { body: 'Komentar akar' }, userToken);
    if (rRoot.status !== 201) throw new Error(`rRoot ${rRoot.status}: ${await rRoot.text()}`);
    expect(rRoot.status).toBe(201);
    const rootId = (await rRoot.json()).data.id as string;

    const rReply = await post(
      `/api/v1/words/${wordId}/comments`,
      { body: '@threaduser Balasan tingkat 1', parent_id: rootId },
      adminToken,
    );
    expect(rReply.status).toBe(201);
    const replyData = (await rReply.json()).data;
    expect(replyData.parent_id).toBe(rootId);

    // Reply-to-reply must be rejected (400)
    const rDeep = await post(
      `/api/v1/words/${wordId}/comments`,
      { body: 'Balasan tingkat 2 tidak boleh', parent_id: replyData.id },
      userToken,
    );
    expect(rDeep.status).toBe(400);

    // List returns top-level only with nested replies[]
    const rList = await get(`/api/v1/words/${wordId}/comments`);
    expect(rList.status).toBe(200);
    const listBody = await rList.json();
    expect(listBody.data).toHaveLength(1);
    expect(listBody.data[0].id).toBe(rootId);
    expect(listBody.data[0].parent_id).toBeNull();
    expect(listBody.data[0].replies).toHaveLength(1);
    expect(listBody.data[0].replies[0].id).toBe(replyData.id);
    expect(listBody.data[0].replies[0].parent_id).toBe(rootId);
  });

  it('place comments: 2-level nesting + edit history + polymorphic place_comment vote', async () => {
    const rRoot = await post(`/api/v1/places/${PLACE_ID}/comments`, { body: 'Tempat bagus!' }, userToken);
    expect(rRoot.status).toBe(201);
    const rootId = (await rRoot.json()).data.id as string;

    const rReply = await post(
      `/api/v1/places/${PLACE_ID}/comments`,
      { body: 'Setuju banget!', parent_id: rootId },
      adminToken,
    );
    expect(rReply.status).toBe(201);
    const replyId = (await rReply.json()).data.id as string;

    // Edit root comment & verify edit-history endpoint
    const rEdit = await patch(`/api/v1/places/comments/${rootId}`, { body: 'Tempat bagus banget!' }, userToken);
    expect(rEdit.status).toBe(200);

    const rHist = await get(`/api/v1/places/comments/${rootId}/edit-history`);
    expect(rHist.status).toBe(200);
    const histBody = await rHist.json();
    expect(histBody.data.current.body).toBe('Tempat bagus banget!');
    expect(histBody.data.current.is_edited).toBe(true);
    expect(histBody.data.revisions).toHaveLength(1);
    expect(histBody.data.revisions[0].body).toBe('Tempat bagus!');

    // Polymorphic vote on place_comment
    const rVote = await post(
      '/api/v1/votes',
      { target_type: 'place_comment', target_id: rootId, value: 1 },
      adminToken,
    );
    expect(rVote.status).toBe(200);

    // List returns 1 root + 1 reply
    const rList = await get(`/api/v1/places/${PLACE_ID}/comments`);
    expect(rList.status).toBe(200);
    const listBody = await rList.json();
    expect(listBody.data.items).toHaveLength(1);
    expect(listBody.data.items[0].id).toBe(rootId);
    expect(listBody.data.items[0].replies).toHaveLength(1);
    expect(listBody.data.items[0].replies[0].id).toBe(replyId);
  });
});
