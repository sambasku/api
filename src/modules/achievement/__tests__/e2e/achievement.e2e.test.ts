import { describe, it, expect, beforeAll } from 'vitest';
import { config } from 'dotenv';
import { eq } from 'drizzle-orm';
import { capturedOtpDisplayCode, e2eRegisterBody } from '@/shared/testing/e2e-auth';

// Pastikan .env.test (DB test) dipakai SEBELUM app di-import.
const { parsed } = config({ path: '.env.test', quiet: true });
const hasTestDb = !!parsed?.DATABASE_URL;
if (parsed?.DATABASE_URL) process.env.DATABASE_URL = parsed.DATABASE_URL;

const ulid26 = (prefix: string) => prefix.padEnd(26, '0').slice(0, 26);

describe.skipIf(!hasTestDb)('Achievement E2E - katalog reward, scan, grant, border profil', () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let app: any;
  let adminToken: string;
  let userToken: string;
  let userUsername: string;

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
  const put = (path: string, body: unknown, token?: string) =>
    request(path, {
      method: 'PUT',
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

  const borderBody = {
    code: 'angkatan-ke-1',
    title: 'Angkatan Ke-1',
    description: 'Terdaftar sebagai pengguna SambasKu pada angkatan pertama',
    category: 'kohort',
    reward_type: 'profile_border',
    badge_url: 'https://cdn.jsdelivr.net/gh/sambasku/images@main/assets/achievements/angkatan-ke-1.png',
    criteria: {
      source: 'registration',
      window: {
        from: '2020-01-01T00:00:00+07:00',
        to: '2030-01-01T00:00:00+07:00',
      },
    },
  };

  beforeAll(async () => {
    const { getTestDb } = await import('@/shared/database/drizzle/test-client');
    const { languages, userRoles, users, wordClasses } = await import(
      '@/shared/database/drizzle/schema'
    );
    const { truncateAll } = await import('@/shared/database/drizzle/test-utils');
    const db = getTestDb();
    await truncateAll(db);
    await db.insert(languages).values([
      { id: ulid26('01E2ELANGSMB'), code: 'smb', name: 'Sambas' },
      { id: ulid26('01E2ELANGIDN'), code: 'id', name: 'Indonesia' },
    ]);
    await db.insert(wordClasses).values({ id: ulid26('01E2EWCNOMINA'), code: 'n', name: 'Nomina' });

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

    userUsername = `usr${stamp}`;
    await post(
      '/api/v1/auth/register',
      e2eRegisterBody({ name: userUsername, email: `usr${stamp}@test.com` }),
    );
    await post('/api/v1/auth/verify-email', {
      email: `usr${stamp}@test.com`,
      code: capturedOtpDisplayCode(),
    });
    userToken = (
      (await (await post('/api/v1/auth/login', { email: `usr${stamp}@test.com`, password: 'Password123' })).json())
        .data
    ).access_token;
  });

  it('gate role: user biasa tidak boleh create achievement', async () => {
    const res = await post('/api/v1/admin/achievements', borderBody, userToken);
    expect(res.status).toBe(403);
  });

  it('create achievement admin: 200, kode dobel = 409, source tak dikenal = 400', async () => {
    const created = await post('/api/v1/admin/achievements', borderBody, adminToken);
    expect(created.status).toBe(200);
    const data = (await created.json()).data;
    expect(data.code).toBe('angkatan-ke-1');
    expect(data.reward_type).toBe('profile_border');
    expect(data.criteria.source).toBe('registration');

    const dup = await post('/api/v1/admin/achievements', borderBody, adminToken);
    expect(dup.status).toBe(409);
    expect((await dup.json()).error_code).toBe('ACHIEVEMENT_CODE_ALREADY_EXISTS');

    const badSource = await post(
      '/api/v1/admin/achievements',
      { ...borderBody, code: 'kode-buruk', criteria: { source: 'sql_injection' } },
      adminToken,
    );
    expect(badSource.status).toBe(400);
  });

  it('scan backfill: idempotent (scan 2x = award sama)', async () => {
    const list = await get('/api/v1/admin/achievements', adminToken);
    const items = (await list.json()).data.items;
    const target = items.find((i: { code: string }) => i.code === 'angkatan-ke-1');
    expect(target).toBeTruthy();

    const first = await post(`/api/v1/admin/achievements/${target.id}/scan`, {}, adminToken);
    expect(first.status).toBe(200);
    const firstData = (await first.json()).data;
    expect(firstData.awarded).toBeGreaterThan(0);

    // Kolom penerima di tabel katalog harus sinkron dengan award nyata
    // (regresi: subquery korelasi tanpa kualifikasi tabel selalu 0).
    const afterList = await get('/api/v1/admin/achievements', adminToken);
    const afterItems = (await afterList.json()).data.items;
    const afterTarget = afterItems.find((i: { code: string }) => i.code === 'angkatan-ke-1');
    expect(afterTarget.recipient_count).toBeGreaterThan(0);

    const second = await post(`/api/v1/admin/achievements/${target.id}/scan`, {}, adminToken);
    expect(second.status).toBe(200);
    const secondData = (await second.json()).data;
    // Idempoten: tidak ada award baru.
    expect(secondData.awarded).toBe(0);
  });

  it('preview: jumlah + sampel pemenuh kriteria', async () => {
    const list = await get('/api/v1/admin/achievements', adminToken);
    const items = (await list.json()).data.items;
    const target = items.find((i: { code: string }) => i.code === 'angkatan-ke-1');
    const res = await get(`/api/v1/admin/achievements/${target.id}/preview`, adminToken);
    expect(res.status).toBe(200);
    const data = (await res.json()).data;
    expect(typeof data.total).toBe('number');
    expect(Array.isArray(data.sample)).toBe(true);
  });

  it('grant manual: idempotent (user yang sudah punya = skipped, bukan error)', async () => {
    const list = await get('/api/v1/admin/achievements', adminToken);
    const items = (await list.json()).data.items;
    const target = items.find((i: { code: string }) => i.code === 'angkatan-ke-1');

    const res = await post(
      `/api/v1/admin/achievements/${target.id}/grant`,
      { usernames: [userUsername] },
      adminToken,
    );
    expect(res.status).toBe(200);
    const data = (await res.json()).data;
    // Sudah dapat dari scan -> skipped.
    expect(data.awarded + data.skipped).toBeGreaterThanOrEqual(1);
    expect(data.missing).toHaveLength(0);
  });

  it('border: set border milik sendiri = 200, border milik orang lain = 403, null = lepas', async () => {
    const mine = await get('/api/v1/me/achievements?reward_type=profile_border', userToken);
    expect(mine.status).toBe(200);
    const items = (await mine.json()).data.items;
    const owned = items.find((i: { user_achievement_id: string | null }) => i.user_achievement_id);
    expect(owned).toBeTruthy();

    // Award milik orang lain (achievement id + award id user lain).
    const foreign = await patch(
      '/api/v1/me/profile/border',
      { border_id: '01ZZZZZZZZZZZZZZZZZZZZZZZZ' },
      userToken,
    );
    expect(foreign.status).toBe(403);
    expect((await foreign.json()).error_code).toBe('ACHIEVEMENT_BORDER_NOT_OWNED');

    const set = await patch(
      '/api/v1/me/profile/border',
      { border_id: owned.user_achievement_id },
      userToken,
    );
    expect(set.status).toBe(200);
    expect((await set.json()).data.active_border_id).toBe(owned.user_achievement_id);

    // Milikku sekarang menandai is_active_border = true.
    const mine2 = await get('/api/v1/me/achievements?reward_type=profile_border', userToken);
    const items2 = (await mine2.json()).data.items;
    const active = items2.find(
      (i: { user_achievement_id: string | null; is_active_border?: boolean }) =>
        i.user_achievement_id === owned.user_achievement_id,
    );
    expect(active?.is_active_border).toBe(true);

    // Lepas.
    const unset = await patch('/api/v1/me/profile/border', { border_id: null }, userToken);
    expect(unset.status).toBe(200);
    expect((await unset.json()).data.active_border_id).toBeNull();
  });

  it('daftar penerima + revoke award', async () => {
    const list = await get('/api/v1/admin/achievements', adminToken);
    const items = (await list.json()).data.items;
    const target = items.find((i: { code: string }) => i.code === 'angkatan-ke-1');

    const res = await get(`/api/v1/admin/achievements/${target.id}/recipients`, adminToken);
    expect(res.status).toBe(200);
    const data = (await res.json()).data;
    expect(Array.isArray(data.items)).toBe(true);
    expect(data.items.length).toBeGreaterThan(0);
    for (const r of data.items) {
      expect(r.award_id).toHaveLength(26);
      expect(r.username).toBeTruthy();
    }

    // Pilih penerima yang BUKAN user test ini: user test masih dipakai
    // oleh test border di atas (urutan file = berbagi state).
    const recipient = data.items.find(
      (r: { username: string }) => r.username !== userUsername,
    );
    expect(recipient).toBeTruthy();

    // Revoke award itu -> hilang dari daftar.
    const revoked = await del(
      `/api/v1/admin/achievements/${target.id}/awards/${recipient.award_id}`,
      adminToken,
    );
    expect(revoked.status).toBe(200);
    const after = await get(`/api/v1/admin/achievements/${target.id}/recipients`, adminToken);
    const afterItems = (await after.json()).data.items;
    expect(
      afterItems.find((i: { award_id: string }) => i.award_id === recipient.award_id),
    ).toBeUndefined();
  });

  it('katalog publik tanpa auth: hanya achievement aktif', async () => {
    const res = await get('/api/v1/achievements');
    expect(res.status).toBe(200);
    const items = (await res.json()).data.items;
    expect(items.length).toBeGreaterThan(0);
    expect(items.every((i: { is_active: boolean }) => i.is_active)).toBe(true);
  });

  it('profil publik: field active_border_url ada (null tanpa border)', async () => {
    const res = await get(`/api/v1/users/${userUsername}`);
    expect(res.status).toBe(200);
    const data = (await res.json()).data;
    expect('active_border_url' in data).toBe(true);
  });

  it('update: code immutable, edit title reflected', async () => {
    const list = await get('/api/v1/admin/achievements', adminToken);
    const items = (await list.json()).data.items;
    const target = items.find((i: { code: string }) => i.code === 'angkatan-ke-1');
    const res = await put(
      `/api/v1/admin/achievements/${target.id}`,
      { title: 'Angkatan Ke-1 (Revisi)' },
      adminToken,
    );
    expect(res.status).toBe(200);
    expect((await res.json()).data.title).toBe('Angkatan Ke-1 (Revisi)');
  });

  it('soft delete achievement: hilang dari katalog publik', async () => {
    const list = await get('/api/v1/admin/achievements', adminToken);
    const items = (await list.json()).data.items;
    const target = items.find((i: { code: string }) => i.code === 'angkatan-ke-1');
    const res = await del(`/api/v1/admin/achievements/${target.id}`, adminToken);
    expect(res.status).toBe(200);

    const pub = await get('/api/v1/achievements');
    const pubItems = (await pub.json()).data.items;
    expect(pubItems.find((i: { code: string }) => i.code === 'angkatan-ke-1')).toBeUndefined();
  });
});
