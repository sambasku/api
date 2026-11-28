import { describe, it, expect, beforeAll } from 'vitest';
import { config } from 'dotenv';
import { and, eq } from 'drizzle-orm';
import { e2eRegisterBody } from '@/shared/testing/e2e-auth';

const { parsed } = config({ path: '.env.test', quiet: true });
const hasTestDb = !!parsed?.DATABASE_URL;
if (parsed?.DATABASE_URL) process.env.DATABASE_URL = parsed.DATABASE_URL;

const ulid26 = (prefix: string) => prefix.padEnd(26, '0').slice(0, 26);
const PLACE_ID = ulid26('01T2EPHOTOPLACE1');
const PLACE_PHOTO_ID = ulid26('01T2EPHOTOIMG1');
const STOCK_PHOTO_ID = ulid26('01T2EPHOTOIMG2');
const CUISINE_ID = ulid26('01T2EPHOTOCUIS1');
const CUISINE_URL = 'https://ik.imagekit.io/sambasku/cuisine/uji-foto.webp';

describe.skipIf(!hasTestDb)('Komentar foto E2E (#387)', () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let app: any;
  let uploaderToken: string;
  let uploaderId: string;
  let commenterToken: string;
  let adminToken: string;
  let cuisineRef: string;

  const request = (path: string, init: RequestInit = {}) =>
    app.request(path, {
      ...init,
      headers: { 'content-type': 'application/json', ...(init.headers ?? {}) },
    });
  const send = (method: string, path: string, body?: unknown, token?: string) =>
    request(path, {
      method,
      body: body === undefined ? undefined : JSON.stringify(body),
      headers: token ? { authorization: `Bearer ${token}` } : {},
    });

  beforeAll(async () => {
    const { getTestDb } = await import('@/shared/database/drizzle/test-client');
    const schema = await import('@/shared/database/drizzle/schema');
    const { users, userRoles, places, placeImages, cuisines } = schema;
    const { truncateAll } = await import('@/shared/database/drizzle/test-utils');
    const { cuisinePhotoRef } = await import('@/modules/photo-comment/domain/photo-ref');
    const db = getTestDb();
    await truncateAll(db);
    app = (await import('@/app')).app;

    for (const [name, email] of [
      ['photoup', 'photo_up@test.com'],
      ['photocom', 'photo_com@test.com'],
      ['photoadm', 'photo_adm@test.com'],
    ] as const) {
      await send('POST', '/api/v1/auth/register', e2eRegisterBody({ name, email }));
    }
    await db.update(users).set({ emailVerified: true });
    const idOf = async (email: string) =>
      (await db.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1))[0]!
        .id;
    uploaderId = await idOf('photo_up@test.com');
    const adminId = await idOf('photo_adm@test.com');
    await db.insert(userRoles).values({ userId: adminId, role: 'admin' }).onConflictDoNothing();

    const login = async (email: string) =>
      (
        await (
          await send('POST', '/api/v1/auth/login', { email, password: 'Password123' })
        ).json()
      ).data.access_token as string;
    uploaderToken = await login('photo_up@test.com');
    commenterToken = await login('photo_com@test.com');
    adminToken = await login('photo_adm@test.com');

    await db.insert(places).values({
      id: PLACE_ID,
      slug: 'pantai-uji-foto',
      name: 'Pantai Uji Foto',
      category: 'pantai',
      shortDescription: 'Pantai untuk uji komentar foto',
      status: 'published',
      authorId: adminId,
    });
    await db.insert(placeImages).values([
      {
        id: PLACE_PHOTO_ID,
        placeId: PLACE_ID,
        url: 'https://ik.imagekit.io/sambasku/places/uji-1.webp',
        attributionJson: JSON.stringify({
          name: 'photoup',
          provider: 'sambasku',
          authorId: uploaderId,
        }),
      },
      {
        id: STOCK_PHOTO_ID,
        placeId: PLACE_ID,
        url: 'https://images.unsplash.com/uji-stock',
        attributionJson: JSON.stringify({ name: 'Unsplash', provider: 'unsplash' }),
      },
    ]);
    await db.insert(cuisines).values({
      id: CUISINE_ID,
      slug: 'kuliner-uji-foto',
      name: 'Kuliner Uji Foto',
      publishStatus: 'published',
      imagesJson: JSON.stringify([
        {
          url: CUISINE_URL,
          isMain: true,
          attribution: { name: 'photoup', provider: 'sambasku', authorId: uploaderId },
        },
      ]),
    });
    cuisineRef = cuisinePhotoRef(CUISINE_ID, CUISINE_URL);
  });

  it('komentar + balasan 2-level, list nested, tolak balasan bertingkat', async () => {
    const base = `/api/v1/photos/place/${PLACE_PHOTO_ID}/comments`;
    const rRoot = await send('POST', base, { body: 'Ini pantai yang mana ya?' }, commenterToken);
    expect(rRoot.status).toBe(201);
    const root = (await rRoot.json()).data;
    expect(root.photo_kind).toBe('place');
    expect(root.photo_ref).toBe(PLACE_PHOTO_ID);

    const rReply = await send(
      'POST',
      base,
      { body: 'Di Tanjung Batu, dekat dermaga', parent_id: root.id },
      uploaderToken,
    );
    expect(rReply.status).toBe(201);
    const reply = (await rReply.json()).data;
    expect(reply.parent_id).toBe(root.id);

    const rDeep = await send(
      'POST',
      base,
      { body: 'Balasan bertingkat tidak boleh', parent_id: reply.id },
      commenterToken,
    );
    expect(rDeep.status).toBe(400);

    const rList = await send('GET', base);
    expect(rList.status).toBe(200);
    const list = (await rList.json()).data;
    expect(list.items).toHaveLength(1);
    expect(list.items[0].replies).toHaveLength(1);
    expect(list.items[0].lemma_links).toEqual([]);
  });

  it('uploader dapat notifikasi inbox saat fotonya dikomentari', async () => {
    const { getTestDb } = await import('@/shared/database/drizzle/test-client');
    const { notifications } = await import('@/shared/database/drizzle/schema');
    const db = getTestDb();
    const rows = await db
      .select()
      .from(notifications)
      .where(and(eq(notifications.userId, uploaderId), eq(notifications.type, 'photo_comment')));
    expect(rows).toHaveLength(1);
    expect(rows[0]!.targetKind).toBe('photo');
    expect(rows[0]!.targetId).toBe(PLACE_PHOTO_ID);
    expect(rows[0]!.actionKind).toBe('photo');
    expect(rows[0]!.actionValue).toBe(`place:pantai-uji-foto:${PLACE_PHOTO_ID}`);
  });

  it('foto stock tanpa uploader: komentar boleh, tanpa notifikasi', async () => {
    const { getTestDb } = await import('@/shared/database/drizzle/test-client');
    const { notifications } = await import('@/shared/database/drizzle/schema');
    const db = getTestDb();
    const before = (await db.select().from(notifications)).length;
    const r = await send(
      'POST',
      `/api/v1/photos/place/${STOCK_PHOTO_ID}/comments`,
      { body: 'Foto stock yang cantik sekali' },
      commenterToken,
    );
    expect(r.status).toBe(201);
    expect((await db.select().from(notifications)).length).toBe(before);
  });

  it('foto kuliner (ref hash) bisa dikomentari; ref salah = 404', async () => {
    const ok = await send(
      'POST',
      `/api/v1/photos/cuisine/${cuisineRef}/comments`,
      { body: 'Enak banget kelihatannya ini' },
      commenterToken,
    );
    expect(ok.status).toBe(201);
    const bad = await send(
      'POST',
      `/api/v1/photos/cuisine/${CUISINE_ID}.0000000000000000/comments`,
      { body: 'Foto ini tidak ada di kuliner' },
      commenterToken,
    );
    expect(bad.status).toBe(404);
    const unknown = await send(
      'POST',
      `/api/v1/photos/place/${ulid26('01T2ETIDAKADA')}/comments`,
      { body: 'Foto ini tidak ada sama sekali' },
      commenterToken,
    );
    expect(unknown.status).toBe(404);
  });

  it('wajib login untuk menulis', async () => {
    const r = await send('POST', `/api/v1/photos/place/${PLACE_PHOTO_ID}/comments`, {
      body: 'Tanpa login seharusnya ditolak',
    });
    expect(r.status).toBe(401);
  });

  it('edit + riwayat sunting + hapus sendiri + takedown admin', async () => {
    const base = `/api/v1/photos/place/${PLACE_PHOTO_ID}/comments`;
    const created = await send('POST', base, { body: 'Komentar yang akan diedit' }, commenterToken);
    const id = (await created.json()).data.id as string;

    const edit = await send('PATCH', `/api/v1/photos/comments/${id}`, { body: 'Komentar sudah diedit' }, commenterToken);
    expect(edit.status).toBe(200);
    const hist = await (await send('GET', `/api/v1/photos/comments/${id}/edit-history`)).json();
    expect(hist.data.current.is_edited).toBe(true);
    expect(hist.data.revisions[0].body).toBe('Komentar yang akan diedit');

    const forbidden = await send('PATCH', `/api/v1/photos/comments/${id}`, { body: 'Diedit orang lain' }, uploaderToken);
    expect(forbidden.status).toBe(403);

    const takedown = await send('POST', `/api/v1/admin/photos/comments/${id}/takedown`, undefined, adminToken);
    expect(takedown.status).toBe(200);

    const mine = await send('POST', base, { body: 'Komentar yang akan dihapus sendiri' }, commenterToken);
    const mineId = (await mine.json()).data.id as string;
    const del = await send('DELETE', `/api/v1/photos/comments/${mineId}`, undefined, commenterToken);
    expect(del.status).toBe(200);
  });

  it('comment-counts: satu panggilan untuk banyak foto, hanya published', async () => {
    const r = await send(
      'GET',
      `/api/v1/photos/comment-counts?kind=place&refs=${PLACE_PHOTO_ID},${STOCK_PHOTO_ID}`,
    );
    expect(r.status).toBe(200);
    const counts = (await r.json()).data.counts as Record<string, number>;
    // PLACE_PHOTO: root + balasan (komentar edit di-takedown, satunya dihapus sendiri).
    expect(counts[PLACE_PHOTO_ID]).toBe(2);
    expect(counts[STOCK_PHOTO_ID]).toBe(1);
  });
});

describe.skipIf(!hasTestDb)('Komentar foto - budget query (#103)', () => {
  it('list komentar foto <= 3 query per request (tops + replies + lemma links)', async () => {
    const { createClient } = await import('@libsql/client');
    const { drizzle } = await import('drizzle-orm/libsql');
    const schema = await import('@/shared/database/drizzle/schema');
    const { PhotoCommentRepositoryImpl } = await import(
      '@/modules/photo-comment/infrastructure/photo-comment.repository.impl'
    );
    const { UgcCommentLemmaRepositoryImpl } = await import(
      '@/modules/ugc-comment-lemma/infrastructure/ugc-comment-lemma.repository.impl'
    );
    const { ListPhotoCommentsUseCase } = await import(
      '@/modules/photo-comment/application/use-cases/photo-comment.use-cases'
    );
    const { attachLemmaLinksToNestedCommentWireItems } = await import(
      '@/modules/ugc-comment-lemma/presentation/enrich-comment-lemma-links'
    );
    const { toPhotoCommentWire } = await import(
      '@/modules/photo-comment/presentation/v1/photo-comment.controller'
    );

    const client = createClient({ url: process.env.DATABASE_URL! });
    const realExecute = client.execute.bind(client);
    let queryCount = 0;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (client as any).execute = async (...args: unknown[]) => {
      queryCount++;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return (realExecute as any)(...args);
    };
    const db = drizzle(client, { schema });

    const uc = new ListPhotoCommentsUseCase(new PhotoCommentRepositoryImpl(db as never));
    queryCount = 0;
    const page = await uc.execute('place', PLACE_PHOTO_ID, undefined, 20);
    await attachLemmaLinksToNestedCommentWireItems(
      new UgcCommentLemmaRepositoryImpl(db as never),
      'photo_comment',
      page.items,
      (item) => toPhotoCommentWire(item),
    );
    expect(page.items.length).toBeGreaterThan(0);
    expect(queryCount).toBeLessThanOrEqual(3);
  });
});
