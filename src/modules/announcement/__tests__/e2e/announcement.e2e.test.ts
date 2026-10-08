import { describe, it, expect, beforeAll } from 'vitest';
import { config } from 'dotenv';
import { capturedOtpDisplayCode, e2eRegisterBody } from '@/shared/testing/e2e-auth';
import { eq } from 'drizzle-orm';

// Pastikan .env.test (DB test) dipakai SEBELUM app di-import (Section 10)
const { parsed } = config({ path: '.env.test', quiet: true });
const hasTestDb = !!parsed?.DATABASE_URL;
if (parsed?.DATABASE_URL) process.env.DATABASE_URL = parsed.DATABASE_URL;

const ulid26 = (prefix: string) => prefix.padEnd(26, '0').slice(0, 26);
const SMB = ulid26('01E2ELANGSMB');
const IDN = ulid26('01E2ELANGIDN');
const NOMINA = ulid26('01E2EWCNOMINA');

describe.skipIf(!hasTestDb)('Announcement E2E - pengumuman admin tayang di feed publik (#102)', () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let app: any;
  let adminToken: string;
  let reviewerToken: string;

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
    const { languages, userRoles, users, wordClasses } = await import('@/shared/database/drizzle/schema');
    const { truncateAll } = await import('@/shared/database/drizzle/test-utils');
    const db = getTestDb();
    await truncateAll(db);
    await db.insert(languages).values([
      { id: SMB, code: 'smb', name: 'Sambas' },
      { id: IDN, code: 'id', name: 'Indonesia' },
    ]);
    await db.insert(wordClasses).values({ id: NOMINA, code: 'n', name: 'Nomina' });

    const appModule = await import('@/app');
    app = appModule.app;

    const stamp = Date.now();
    await post('/api/v1/auth/register', e2eRegisterBody({ name: `adm${stamp}`, email: `adm${stamp}@test.com` }));
    await post('/api/v1/auth/verify-email', { email: `adm${stamp}@test.com`, code: capturedOtpDisplayCode() });
    const [uid] = await db.select({ id: users.id }).from(users).where(eq(users.email, `adm${stamp}@test.com`)).limit(1);
    if (uid) await db.insert(userRoles).values({ userId: uid.id, role: 'admin' }).onConflictDoNothing();
    adminToken = ((await (await post('/api/v1/auth/login', { email: `adm${stamp}@test.com`, password: 'Password123' })).json()).data).access_token;

    await post('/api/v1/auth/register', e2eRegisterBody({ name: `rev${stamp}`, email: `rev${stamp}@test.com` }));
    await post('/api/v1/auth/verify-email', { email: `rev${stamp}@test.com`, code: capturedOtpDisplayCode() });
    const [rid] = await db.select({ id: users.id }).from(users).where(eq(users.email, `rev${stamp}@test.com`)).limit(1);
    if (rid) await db.insert(userRoles).values({ userId: rid.id, role: 'reviewer' }).onConflictDoNothing();
    reviewerToken = ((await (await post('/api/v1/auth/login', { email: `rev${stamp}@test.com`, password: 'Password123' })).json()).data).access_token;
  });

  it('gate role: reviewer TIDAK boleh membuat pengumuman', async () => {
    const res = await post(
      '/api/v1/admin/announcements',
      { title: 'Dilarang', body: 'Reviewer tidak boleh.' },
      reviewerToken,
    );
    expect(res.status).toBe(403);
  });

  it('validasi: action_label tanpa action_url ditolak; non-https ditolak; host eksternal kini diizinkan (#124)', async () => {
    const noUrl = await post(
      '/api/v1/admin/announcements',
      { title: 'Judul', body: 'Isi', action_label: 'Buka' },
      adminToken,
    );
    expect(noUrl.status).toBe(400);

    const notHttps = await post(
      '/api/v1/admin/announcements',
      { title: 'Judul', body: 'Isi', action_url: 'http://example.com/x' },
      adminToken,
    );
    expect(notHttps.status).toBe(400);

    // #124: host bebas (https) - dibedakan deep link/eksternal di client.
    // Dibuat lalu dihapus: expired tetap tayang di feed (#102), jadi bersihkan
    // via delete supaya tak ganggu test dedupe di bawah.
    const externalHost = await post(
      '/api/v1/admin/announcements',
      { title: 'Judul', body: 'Isi', action_url: 'https://example.com/x' },
      adminToken,
    );
    expect(externalHost.status).toBe(200);
    const externalAnn = (await externalHost.json()).data;
    await del(`/api/v1/admin/announcements/${externalAnn.id}`, adminToken);

    // #124 lanjutan: body_type enum valid; default plain; invalid 400.
    const md = await post(
      '/api/v1/admin/announcements',
      { title: 'Judul', body: '# Isi', body_type: 'md' },
      adminToken,
    );
    expect(md.status).toBe(200);
    const mdData = (await md.json()).data;
    expect(mdData.body_type).toBe('md');
    await del(`/api/v1/admin/announcements/${mdData.id}`, adminToken);

    const badType = await post(
      '/api/v1/admin/announcements',
      { title: 'Judul', body: 'Isi', body_type: 'pdf' },
      adminToken,
    );
    expect(badType.status).toBe(400);

    const def = await post(
      '/api/v1/admin/announcements',
      { title: 'Judul', body: 'Isi' },
      adminToken,
    );
    expect(def.status).toBe(200);
    const defData = (await def.json()).data;
    expect(defData.body_type).toBe('plain');
    await del(`/api/v1/admin/announcements/${defData.id}`, adminToken);
  });

  it('create → tayang di feed publik dengan payload announcement; edit refresh copy; delete hilang', async () => {
    // 1. Buat
    const created = await post(
      '/api/v1/admin/announcements',
      {
        title: 'Kamus baru rilis',
        body: 'Update v0.3 minggu ini.',
        action_url: 'https://sambasku.com/blog/rilis',
        action_label: 'Baca rilis',
      },
      adminToken,
    );
    expect(created.status).toBe(200);
    const ann = (await created.json()).data;
    expect(ann.title).toBe('Kamus baru rilis');
    expect(ann.action_url).toBe('https://sambasku.com/blog/rilis');

    // 2. Feed publik menampilkan kind announcement + payload
    const feed1 = await get('/api/v1/activity?limit=20');
    expect(feed1.status).toBe(200);
    const items1 = (await feed1.json()).data;
    const tile = items1.find((i: { kind: string }) => i.kind === 'announcement');
    expect(tile).toBeTruthy();
    expect(tile.announcement.title).toBe('Kamus baru rilis');
    expect(tile.announcement.action_label).toBe('Baca rilis');
    expect(tile.announcement.expired).toBe(false);
    expect(tile.target?.type).toBe('announcement');

    // 3. Edit → copy feed ikut berubah (write-through dedupeKey sama)
    const edited = await patch(
      `/api/v1/admin/announcements/${ann.id}`,
      { title: 'Kamus baru rilis (revisi)' },
      adminToken,
    );
    expect(edited.status).toBe(200);
    const feed2 = await get('/api/v1/activity?limit=20');
    const items2 = (await feed2.json()).data;
    const tile2 = items2.find((i: { kind: string }) => i.kind === 'announcement');
    expect(tile2.announcement.title).toBe('Kamus baru rilis (revisi)');
    // Satu baris saja (dedupe, bukan numpuk)
    expect(items2.filter((i: { kind: string }) => i.kind === 'announcement')).toHaveLength(1);

    // 4. Delete → hilang dari feed
    const removed = await del(`/api/v1/admin/announcements/${ann.id}`, adminToken);
    expect(removed.status).toBe(200);
    const feed3 = await get('/api/v1/activity?limit=20');
    const items3 = (await feed3.json()).data;
    expect(items3.filter((i: { kind: string }) => i.kind === 'announcement')).toHaveLength(0);
  });

  it('expires_at lewat → masih tayang dengan expired=true (feed tak bergeser)', async () => {
    const created = await post(
      '/api/v1/admin/announcements',
      {
        title: 'Maintenance',
        body: 'Server maintenance besok.',
        expires_at: Math.floor(Date.now() / 1000) - 60, // sudah lewat
      },
      adminToken,
    );
    expect(created.status).toBe(200);

    const feed = await get('/api/v1/activity?limit=20');
    const items = (await feed.json()).data;
    const tile = items.find((i: { kind: string }) => i.kind === 'announcement');
    expect(tile).toBeTruthy();
    expect(tile.announcement.expired).toBe(true);
  });

  it('publik GET /api/v1/announcements/:id - tamu bisa baca; soft delete 404; expired=true', async () => {
    // Tamu (tanpa token) baca detail by id
    const created = await post(
      '/api/v1/admin/announcements',
      { title: 'Deep link', body: 'Bisa dibuka tanpa login.' },
      adminToken,
    );
    const { id } = (await created.json()).data;

    const guest = await get(`/api/v1/announcements/${id}`);
    expect(guest.status).toBe(200);
    const detail = (await guest.json()).data;
    expect(detail.id).toBe(id);
    expect(detail.title).toBe('Deep link');
    expect(detail.expired).toBe(false);

    // Kadaluarsa tetap 200 + expired=true (konsisten feed)
    await patch(`/api/v1/admin/announcements/${id}`, { expires_at: Math.floor(Date.now() / 1000) - 60 }, adminToken);
    const expired = await get(`/api/v1/announcements/${id}`);
    expect(expired.status).toBe(200);
    expect((await expired.json()).data.expired).toBe(true);

    // Soft delete → 404 utk tamu
    await del(`/api/v1/admin/announcements/${id}`, adminToken);
    const gone = await get(`/api/v1/announcements/${id}`);
    expect(gone.status).toBe(404);
    expect((await gone.json()).error_code).toBe('ANNOUNCEMENT_NOT_FOUND');

    // Id sampah → 404
    const junk = await get(`/api/v1/announcements/${ulid26('01JUNK')}`);
    expect(junk.status).toBe(404);
  });
});
