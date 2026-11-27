import { describe, it, expect, beforeAll } from 'vitest';
import { config } from 'dotenv';
import { eq } from 'drizzle-orm';
import { capturedOtpDisplayCode, e2eRegisterBody } from '@/shared/testing/e2e-auth';

const { parsed } = config({ path: '.env.test', quiet: true });
const hasTestDb = !!parsed?.DATABASE_URL;
if (parsed?.DATABASE_URL) process.env.DATABASE_URL = parsed.DATABASE_URL;

const KEC_ID = '01E2ECHKEC00000000000001';
const DESA_ID = '01E2ECHDESA0000000000001';

type Item = { action: string; action_label: string; changes: { field: string; display_old: string; display_new: string }[] };

describe.skipIf(!hasTestDb)('Riwayat perubahan fase 2 - usaha, acara, layanan, karya, komunitas', () => {
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

  const history = async (path: string): Promise<{ data: Item[]; meta: { has_more: boolean } }> => {
    const res = await call('GET', path);
    expect(res.status).toBe(200);
    return res.json();
  };

  beforeAll(async () => {
    const { getTestDb } = await import('@/shared/database/drizzle/test-client');
    const { kategoriKomunitas, regions, userRoles, users } = await import(
      '@/shared/database/drizzle/schema'
    );
    const { truncateAll } = await import('@/shared/database/drizzle/test-utils');
    const db = getTestDb();
    await truncateAll(db);
    await db.insert(regions).values([
      { id: KEC_ID, slug: 'pemangkat', name: 'Pemangkat', type: 'kecamatan', status: 'published' },
      { id: DESA_ID, slug: 'pemangkat/perapakan', name: 'Perapakan', type: 'desa', parentId: KEC_ID, status: 'published' },
    ]);
    await db
      .insert(kategoriKomunitas)
      .values({ id: 'lain', name: 'Lainnya', status: 'published', sortOrder: 0, createdAt: new Date() })
      .onConflictDoNothing();
    app = (await import('@/app')).app;

    const stamp = Date.now();
    const email = `ch2adm${stamp}@test.com`;
    await call('POST', '/api/v1/auth/register', e2eRegisterBody({ name: `ch2adm${stamp}`, email }));
    await call('POST', '/api/v1/auth/verify-email', { email, code: capturedOtpDisplayCode() });
    const [u] = await db.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1);
    await db.insert(userRoles).values({ userId: u!.id, role: 'admin' }).onConflictDoNothing();
    adminToken = (
      await (await call('POST', '/api/v1/auth/login', { email, password: 'Password123' })).json()
    ).data.access_token;
  });

  it('usaha: buat, ubah, batasi, pulihkan masuk timeline publik', async () => {
    const created = await call(
      'POST',
      '/api/v1/admin/usaha',
      {
        slug: 'warung-riwayat',
        name: 'Warung Riwayat',
        description: 'Awal.',
        category_id: 'kuliner',
        kind: 'product',
        region_id: KEC_ID,
        village_id: DESA_ID,
        phone: '081200000001',
        publish_status: 'published',
        operational_status: 'open',
      },
      adminToken,
    );
    expect(created.status).toBe(200);
    const id = (await created.json()).data.id as string;

    expect((await call('PATCH', `/api/v1/admin/usaha/${id}`, { phone: '081299999999' }, adminToken)).status).toBe(200);
    expect(
      (await call('POST', `/api/v1/admin/usaha/${id}/restrict`, { reason: 'Uji riwayat' }, adminToken)).status,
    ).toBe(200);
    expect((await call('POST', `/api/v1/admin/usaha/${id}/restore`, {}, adminToken)).status).toBe(200);

    const body = await history('/api/v1/usaha/warung-riwayat/change-history');
    expect(body.data.map((i) => i.action)).toEqual(['publish', 'unpublish', 'update', 'create']);
    expect(body.data[2]!.changes).toEqual([
      expect.objectContaining({ field: 'phone', display_old: '081200000001', display_new: '081299999999' }),
    ]);
    expect(body.data[1]!.changes).toEqual([
      expect.objectContaining({ field: 'status', display_old: 'Tayang', display_new: 'Dibatasi' }),
    ]);
    expect((await call('GET', '/api/v1/usaha/tidak-ada/change-history')).status).toBe(404);
  });

  it('acara: buat, ubah, batalkan masuk timeline publik', async () => {
    const created = await call(
      'POST',
      '/api/v1/admin/events',
      {
        slug: 'acara-riwayat',
        name: 'Acara Riwayat',
        description: 'Awal.',
        category_id: 'budaya-tradisi',
        starts_at: new Date(Date.now() + 86_400_000).toISOString(),
        ends_at: new Date(Date.now() + 90_000_000).toISOString(),
        location_text: 'Lapangan Pemangkat',
        region_id: KEC_ID,
        village_id: DESA_ID,
      },
      adminToken,
    );
    expect(created.status).toBe(200);
    const id = (await created.json()).data.id as string;

    expect((await call('PATCH', `/api/v1/admin/events/${id}`, { description: 'Awal.', location_text: 'Alun-alun' }, adminToken)).status).toBe(200);
    expect((await call('POST', `/api/v1/admin/events/${id}/cancel`, { cancelled: true }, adminToken)).status).toBe(200);

    const body = await history('/api/v1/events/acara-riwayat/change-history');
    expect(body.data.map((i) => i.action)).toEqual(['update', 'update', 'create']);
    expect(body.data[0]!.changes).toEqual([
      expect.objectContaining({ field: 'cancelled', label: 'Pembatalan', display_old: 'Aktif', display_new: 'Dibatalkan' }),
    ]);
    expect(body.data[1]!.changes).toEqual([
      expect.objectContaining({ field: 'location', display_old: 'Lapangan Pemangkat', display_new: 'Alun-alun' }),
    ]);
  });

  it('layanan: buat, ubah, tarik, tayangkan masuk timeline publik', async () => {
    const created = await call(
      'POST',
      '/api/v1/admin/layanan',
      {
        category: 'ambulance',
        name: 'Ambulans Riwayat',
        phones: [{ phone: '081234567890', note: 'Pos utama' }],
        region_id: KEC_ID,
      },
      adminToken,
    );
    expect(created.status).toBe(201);
    const data = (await created.json()).data as { id: string; slug: string };

    expect(
      (
        await call(
          'PUT',
          `/api/v1/admin/layanan/${data.id}`,
          {
            category: 'ambulance',
            name: 'Ambulans Riwayat',
            phones: [{ phone: '081234567890', note: 'Pos utama' }, { phone: '081211112222' }],
            region_id: KEC_ID,
          },
          adminToken,
        )
      ).status,
    ).toBe(200);
    expect((await call('POST', `/api/v1/admin/layanan/${data.id}/unpublish`, {}, adminToken)).status).toBe(200);
    expect((await call('POST', `/api/v1/admin/layanan/${data.id}/publish`, {}, adminToken)).status).toBe(200);

    const body = await history(`/api/v1/layanan/${data.slug}/change-history`);
    expect(body.data.map((i) => i.action)).toEqual(['publish', 'unpublish', 'update', 'create']);
    expect(body.data[2]!.changes.map((c) => c.field)).toEqual(['phones']);
  });

  it('karya: buat, ubah, arsipkan masuk timeline publik', async () => {
    const payload = {
      title: 'Lagu Riwayat',
      kind: 'music',
      language: 'id',
      credits: [{ role: 'vocal', name_text: 'Budi' }],
    };
    const created = await call('POST', '/api/v1/admin/karya', payload, adminToken);
    expect(created.status).toBeLessThan(300);
    const row = (await created.json()).data as { id: string; slug: string };

    expect(
      (await call('PUT', `/api/v1/admin/karya/${row.id}`, { ...payload, description: 'Lagu uji.' }, adminToken)).status,
    ).toBeLessThan(300);
    expect((await call('POST', `/api/v1/admin/karya/${row.id}/unpublish`, {}, adminToken)).status).toBeLessThan(300);
    expect((await call('POST', `/api/v1/admin/karya/${row.id}/publish`, {}, adminToken)).status).toBeLessThan(300);

    const body = await history(`/api/v1/karya/${row.slug}/change-history`);
    expect(body.data.map((i) => i.action)).toEqual(['publish', 'unpublish', 'update', 'create']);
    expect(body.data[2]!.changes).toEqual([
      expect.objectContaining({ field: 'description', display_new: 'Lagu uji.' }),
    ]);
  });

  it('komunitas: buat, ubah, arsipkan masuk timeline publik', async () => {
    const created = await call(
      'POST',
      '/api/v1/admin/community/orgs',
      { name: 'Komunitas Riwayat', category_id: 'lain', description: 'Awal.' },
      adminToken,
    );
    expect(created.status).toBeLessThan(300);
    const row = (await created.json()).data as { id: string; slug: string };

    expect(
      (await call('PUT', `/api/v1/admin/community/orgs/${row.id}`, { description: 'Diubah.' }, adminToken)).status,
    ).toBeLessThan(300);
    expect(
      (await call('POST', `/api/v1/admin/community/orgs/${row.id}/status`, { status: 'archived' }, adminToken)).status,
    ).toBeLessThan(300);
    expect(
      (await call('POST', `/api/v1/admin/community/orgs/${row.id}/status`, { status: 'published' }, adminToken)).status,
    ).toBeLessThan(300);

    const body = await history(`/api/v1/community/orgs/${row.slug}/change-history`);
    expect(body.data.map((i) => i.action)).toEqual(['publish', 'unpublish', 'update', 'create']);
    expect(body.data[2]!.changes).toEqual([
      expect.objectContaining({ field: 'description', display_old: 'Awal.', display_new: 'Diubah.' }),
    ]);
  });
});
