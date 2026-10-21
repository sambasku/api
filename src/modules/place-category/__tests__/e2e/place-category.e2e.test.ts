import { describe, it, expect, beforeAll } from 'vitest';
import { config } from 'dotenv';
import { capturedOtpDisplayCode, e2eRegisterBody } from '@/shared/testing/e2e-auth';
import { eq } from 'drizzle-orm';

const { parsed } = config({ path: '.env.test', quiet: true });
const hasTestDb = !!parsed?.DATABASE_URL;
if (parsed?.DATABASE_URL) process.env.DATABASE_URL = parsed.DATABASE_URL;

describe.skipIf(!hasTestDb)('Place category E2E - CRUD admin + list publik', () => {
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

  it('seed wisata/kuliner/budaya tampil publik; admin bisa tambah dan hapus yang kosong', async () => {
    const listRes = await get('/api/v1/place-categories');
    expect(listRes.status).toBe(200);
    const ids = ((await listRes.json()).data.items as { id: string }[]).map((x) => x.id);
    expect(ids).toEqual(expect.arrayContaining(['wisata', 'kuliner', 'budaya']));

    const createRes = await post(
      '/api/v1/admin/place-categories',
      { id: 'religi', name: 'Religi', sort_order: 3 },
      adminToken,
    );
    expect(createRes.status).toBe(200);
    expect((await createRes.json()).data.id).toBe('religi');

    const dup = await post(
      '/api/v1/admin/place-categories',
      { id: 'religi', name: 'Religi 2' },
      adminToken,
    );
    expect(dup.status).toBe(409);

    const unknownPlace = await post(
      '/api/v1/admin/places',
      { slug: 'cat-unknown-e2e', name: 'X', category: 'tidak-ada', short_description: 'x' },
      adminToken,
    );
    expect(unknownPlace.status).toBe(400);

    const delRes = await del('/api/v1/admin/place-categories/by-id?id=religi', adminToken);
    expect(delRes.status).toBe(200);
  });
});
