import { describe, it, expect, beforeAll } from 'vitest';
import { config } from 'dotenv';
import { capturedOtpDisplayCode, e2eRegisterBody } from '@/shared/testing/e2e-auth';
import { eq } from 'drizzle-orm';

const { parsed } = config({ path: '.env.test', quiet: true });
const hasTestDb = !!parsed?.DATABASE_URL;
if (parsed?.DATABASE_URL) process.env.DATABASE_URL = parsed.DATABASE_URL;

describe.skipIf(!hasTestDb)('Place E2E - CRUD admin + list publik', () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let app: any;
  let adminToken: string;

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
    const ulid26 = (prefix: string) => prefix.padEnd(26, '0').slice(0, 26);
    await db.insert(languages).values([
      { id: ulid26('01E2ELANGSMB'), code: 'smb', name: 'Sambas' },
      { id: ulid26('01E2ELANGIDN'), code: 'id', name: 'Indonesia' },
    ]);
    await db.insert(wordClasses).values({
      id: ulid26('01E2EWCNOMINA'),
      code: 'n',
      name: 'Nomina',
    });

    const appModule = await import('@/app');
    app = appModule.app;

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
  });

  it('admin create → publik list/detail → soft delete hilang dari publik', async () => {
    const createRes = await post(
      '/api/v1/admin/places',
      {
        slug: 'pantai-test-e2e',
        name: 'Pantai Test E2E',
        category: 'wisata',
        type: 'pantai',
        lat: 1.35,
        lng: 109.2,
        short_description: 'Deskripsi singkat untuk uji e2e.',
        region_id: 'pemangkat',
        images: [
          {
            url: 'https://cdn.jsdelivr.net/gh/sambasku/images@main/assets/places/test.webp',
            is_main: true,
            attribution: { name: 'Tester', provider: 'sambasku', authorId: 'iamutaki' },
          },
        ],
        sources: [
          {
            name: 'Sumber uji',
            type: 'web',
            address: 'https://example.com/sumber',
          },
        ],
      },
      adminToken,
    );
    expect(createRes.status).toBe(200);
    const created = (await createRes.json()).data;
    expect(created.slug).toBe('pantai-test-e2e');
    expect(created.images).toHaveLength(1);
    expect(created.images[0].is_main).toBe(true);

    const listRes = await get('/api/v1/places?category=wisata');
    expect(listRes.status).toBe(200);
    const list = (await listRes.json()).data.items;
    expect(list.some((p: { slug: string }) => p.slug === 'pantai-test-e2e')).toBe(true);

    const detailRes = await get('/api/v1/places/pantai-test-e2e');
    expect(detailRes.status).toBe(200);
    expect((await detailRes.json()).data.name).toBe('Pantai Test E2E');

    const patchRes = await patch(
      `/api/v1/admin/places/${created.id}`,
      { name: 'Pantai Test E2E Updated' },
      adminToken,
    );
    expect(patchRes.status).toBe(200);
    expect((await patchRes.json()).data.name).toBe('Pantai Test E2E Updated');

    const delRes = await del(`/api/v1/admin/places/${created.id}`, adminToken);
    expect(delRes.status).toBe(200);

    const gone = await get('/api/v1/places/pantai-test-e2e');
    expect(gone.status).toBe(404);
  });

  it('slug bentrok → 409 SLUG_TAKEN', async () => {
    const body = {
      slug: 'slug-dup-e2e',
      name: 'A',
      category: 'budaya',
      short_description: 'x',
    };
    expect((await post('/api/v1/admin/places', body, adminToken)).status).toBe(200);
    const dup = await post('/api/v1/admin/places', body, adminToken);
    expect(dup.status).toBe(409);
    expect((await dup.json()).error_code).toBe('SLUG_TAKEN');
  });
});
