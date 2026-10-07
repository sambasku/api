import { describe, it, expect, beforeAll } from 'vitest';
import { config } from 'dotenv';
import { capturedOtpDisplayCode, e2eRegisterBody } from '@/shared/testing/e2e-auth';
import { eq } from 'drizzle-orm';

// Pastikan .env.test (DB test) dipakai SEBELUM app di-import
const { parsed } = config({ path: '.env.test', quiet: true });
const hasTestDb = !!parsed?.DATABASE_URL;
if (parsed?.DATABASE_URL) process.env.DATABASE_URL = parsed.DATABASE_URL;

// Console #31: respons WA admin wajib envelope { success: true, data } -
// console membaca res.data.data.templates; tanpa envelope halaman mati total.
describe.skipIf(!hasTestDb)('WA Admin E2E - envelope + CRUD template (#31)', () => {
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

  beforeAll(async () => {
    const { getTestDb } = await import('@/shared/database/drizzle/test-client');
    const { users, userRoles, waMessageTemplates, waUsage } = await import(
      '@/shared/database/drizzle/schema'
    );
    const { truncateAll } = await import('@/shared/database/drizzle/test-utils');
    const db = getTestDb();
    await truncateAll(db);

    const appModule = await import('@/app');
    app = appModule.app;

    const stamp = Date.now();
    await post('/api/v1/auth/register', e2eRegisterBody({ name: `adm${stamp}`, email: `adm${stamp}@test.com` }));
    await post('/api/v1/auth/verify-email', { email: `adm${stamp}@test.com`, code: capturedOtpDisplayCode() });
    const [u] = await db.select({ id: users.id }).from(users).where(eq(users.email, `adm${stamp}@test.com`)).limit(1);
    if (u) await db.insert(userRoles).values({ userId: u.id, role: 'admin' }).onConflictDoNothing();
    adminToken = (
      (await (await post('/api/v1/auth/login', { email: `adm${stamp}@test.com`, password: 'Password123' })).json())
        .data
    ).access_token;

    // Seed minimal: 1 template + usage kapso (pola 0057)
    await db.insert(waMessageTemplates).values({
      eventKey: 'verifier_application_approved',
      enabled: false,
      metaTemplateName: 'verifier_approved',
      metaTemplateLanguage: 'id',
      body: 'Selamat {{displayName}}, lulus!',
      params: [{ name: 'displayName', description: 'Nama' }],
    });
    await db.insert(waUsage).values({ provider: 'kapso' });
  });

  it('GET /admin/wa/templates balas envelope { success, data: { templates } }', async () => {
    const res = await get('/api/v1/admin/wa/templates', adminToken);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(Array.isArray(body.data?.templates)).toBe(true);
    expect(body.data.templates.length).toBeGreaterThan(0);
    expect(body.data.templates[0].event_key).toBe('verifier_application_approved');
  });

  it('POST /admin/wa/templates membuat template baru (event bebas, tanpa migrasi)', async () => {
    const res = await post(
      '/api/v1/admin/wa/templates',
      {
        event_key: 'test_event_baru',
        meta_template_name: 'test_event_baru_tpl',
        meta_template_language: 'id',
        body: 'Halo {{nama}}, ini uji.',
        params: [{ name: 'nama', description: 'Nama penerima' }],
        enabled: false,
      },
      adminToken,
    );
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data?.template?.event_key).toBe('test_event_baru');
    expect(body.data.template.params).toHaveLength(1);
  });

  it('POST /admin/wa/templates tolak event_key duplikat (409)', async () => {
    const res = await post(
      '/api/v1/admin/wa/templates',
      {
        event_key: 'verifier_application_approved',
        meta_template_name: 'dup',
        body: 'x',
      },
      adminToken,
    );
    expect(res.status).toBe(409);
  });

  it('GET+PATCH /admin/wa/usage balas envelope dan koreksi tersimpan', async () => {
    const res0 = await get('/api/v1/admin/wa/usage', adminToken);
    const b0 = await res0.json();
    expect(res0.status).toBe(200);
    expect(b0.success).toBe(true);
    expect(b0.data?.usage?.provider).toBe('kapso');

    const res = await patch('/api/v1/admin/wa/usage', { limit_count: 500, warn_threshold_percent: 90 }, adminToken);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data.usage.limit_count).toBe(500);
    expect(body.data.usage.warn_threshold_percent).toBe(90);
  });

  it('PATCH /admin/wa/templates/:id edit body + balas envelope', async () => {
    const list = (await (await get('/api/v1/admin/wa/templates', adminToken)).json()).data.templates;
    const tpl = list.find((t: { event_key: string }) => t.event_key === 'test_event_baru');
    const res = await patch(
      `/api/v1/admin/wa/templates/${tpl.id}`,
      { body: 'Halo {{nama}}, revisi.' },
      adminToken,
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data.template.body).toBe('Halo {{nama}}, revisi.');
  });

  it('placeholder tak dikenal ditolak 400 (params source of truth)', async () => {
    const list = (await (await get('/api/v1/admin/wa/templates', adminToken)).json()).data.templates;
    const tpl = list.find((t: { event_key: string }) => t.event_key === 'test_event_baru');
    const res = await patch(`/api/v1/admin/wa/templates/${tpl.id}`, { body: 'Hi {{ngasal}}' }, adminToken);
    expect(res.status).toBe(400);
  });

  it('GET /admin/wa/logs balas envelope { success, data: { logs } }', async () => {
    const res = await get('/api/v1/admin/wa/logs', adminToken);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(Array.isArray(body.data?.logs)).toBe(true);
  });

  it('tanpa token 401 (gate admin tetap)', async () => {
    const res = await get('/api/v1/admin/wa/templates');
    expect(res.status).toBe(401);
  });
});
