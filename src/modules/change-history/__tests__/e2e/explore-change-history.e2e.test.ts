import { describe, it, expect, beforeAll } from 'vitest';
import { config } from 'dotenv';
import { eq } from 'drizzle-orm';
import { capturedOtpDisplayCode, e2eRegisterBody } from '@/shared/testing/e2e-auth';

const { parsed } = config({ path: '.env.test', quiet: true });
const hasTestDb = !!parsed?.DATABASE_URL;
if (parsed?.DATABASE_URL) process.env.DATABASE_URL = parsed.DATABASE_URL;

describe.skipIf(!hasTestDb)('Riwayat perubahan wisata & kuliner - E2E dari endpoint admin', () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let app: any;
  let adminToken: string;

  const call = (method: string, path: string, body?: unknown, token?: string) =>
    app.request(path, {
      method,
      body: body === undefined ? undefined : JSON.stringify(body),
      headers: {
        'content-type': 'application/json',
        ...(token ? { authorization: `Bearer ${token}` } : {}),
      },
    });

  beforeAll(async () => {
    const { getTestDb } = await import('@/shared/database/drizzle/test-client');
    const { languages, userRoles, users, wordClasses } = await import(
      '@/shared/database/drizzle/schema'
    );
    const { truncateAll } = await import('@/shared/database/drizzle/test-utils');
    const db = getTestDb();
    await truncateAll(db);
    await db.insert(languages).values([
      { id: '01E2ELANGSMB00000000CH01', code: 'smb', name: 'Sambas' },
      { id: '01E2ELANGIDN00000000CH01', code: 'id', name: 'Indonesia' },
    ]);
    await db.insert(wordClasses).values({ id: '01E2EWCNOMINA0000000CH01', code: 'n', name: 'Nomina' });
    app = (await import('@/app')).app;

    const stamp = Date.now();
    const email = `chadm${stamp}@test.com`;
    await call('POST', '/api/v1/auth/register', e2eRegisterBody({ name: `chadm${stamp}`, email }));
    await call('POST', '/api/v1/auth/verify-email', { email, code: capturedOtpDisplayCode() });
    const [u] = await db.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1);
    await db.insert(userRoles).values({ userId: u!.id, role: 'admin' }).onConflictDoNothing();
    adminToken = (
      await (await call('POST', '/api/v1/auth/login', { email, password: 'Password123' })).json()
    ).data.access_token;
  });

  it('wisata: create + edit admin masuk timeline publik, tanpa login', async () => {
    const created = await call(
      'POST',
      '/api/v1/admin/places',
      {
        slug: 'pantai-riwayat',
        name: 'Pantai Riwayat',
        category: 'wisata',
        short_description: 'Awal.',
      },
      adminToken,
    );
    expect(created.status).toBe(200);
    const id = (await created.json()).data.id as string;

    const edited = await call('PATCH', `/api/v1/admin/places/${id}`, { name: 'Pantai Riwayat Indah' }, adminToken);
    expect(edited.status).toBe(200);

    const res = await call('GET', '/api/v1/places/pantai-riwayat/change-history');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.map((i: { action: string }) => i.action)).toEqual(['update', 'create']);
    expect(body.data[0].action_label).toBe('Data diperbarui');
    expect(body.data[0].changes).toEqual([
      expect.objectContaining({ field: 'name', label: 'Nama', display_old: 'Pantai Riwayat', display_new: 'Pantai Riwayat Indah' }),
    ]);
    expect(body.data[0].actor.user_id).toBeTruthy();
    expect(body.meta.has_more).toBe(false);

    expect((await call('GET', '/api/v1/places/tidak-ada-slug/change-history')).status).toBe(404);
  });

  it('kuliner: create + edit + batasi admin masuk timeline publik', async () => {
    const created = await call(
      'POST',
      '/api/v1/admin/culinary/cuisines',
      { slug: 'kuliner-riwayat', name: 'Kuliner Riwayat', description: 'Awal.' },
      adminToken,
    );
    expect(created.status).toBe(200);
    const id = (await created.json()).data.id as string;

    const edited = await call('PATCH', `/api/v1/admin/culinary/cuisines/${id}`, { description: 'Sudah diubah.' }, adminToken);
    expect(edited.status).toBe(200);

    const res = await call('GET', '/api/v1/culinary/cuisines/kuliner-riwayat/change-history');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.map((i: { action: string }) => i.action)).toEqual(['update', 'create']);
    expect(body.data[0].changes).toEqual([
      expect.objectContaining({ field: 'description', label: 'Deskripsi', display_old: 'Awal.', display_new: 'Sudah diubah.' }),
    ]);
  });
});
