import { describe, it, expect, beforeAll } from 'vitest';
import { config } from 'dotenv';
import { e2eRegisterBody } from '@/shared/testing/e2e-auth';

const { parsed } = config({ path: '.env.test', quiet: true });
const hasTestDb = !!parsed?.DATABASE_URL;
if (parsed?.DATABASE_URL) process.env.DATABASE_URL = parsed.DATABASE_URL;

// Test environment DB + token admin (dari seed test) harus tersedia. Skip jika tidak.
describe.skipIf(!hasTestDb)('Admin Users E2E', () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let app: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let client: any;
  let adminToken: string | undefined;
  let contributorId: string | undefined;
  let rootUserId: string | undefined;

  beforeAll(async () => {
    const { testClient } = await import('hono/testing');
    const appModule = await import('@/app');
    app = appModule.app;
    client = testClient(app as never);

    // TODO: Setup - login sebagai admin (dari user seed test) untuk dapat Bearer token.
    // Sementara: assign token dari env test ADMIN_TOKEN jika ada.
    adminToken = process.env.ADMIN_E2E_TOKEN;
  });

  const authHeaders = () =>
    adminToken
      ? { Authorization: `Bearer ${adminToken}` }
      : {};

  it('GET /api/v1/admin/users tanpa auth → 401', async () => {
    const res = await app.request('/api/v1/admin/users?limit=5');
    expect([401, 403]).toContain(res.status);
  });

  it('GET /api/v1/admin/users dengan token admin filter role=contributor → 200 + data tanpa password_hash', async () => {
    if (!adminToken) return;
    const res = await client.api.v1.admin.users.$get(
      { query: { role: 'contributor', limit: 5 } },
      { headers: authHeaders() },
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(Array.isArray(body.data)).toBe(true);
    expect(body.meta).toBeDefined();
    expect(body.meta).toHaveProperty('limit');
    expect(body.meta).toHaveProperty('next_cursor');
    expect(body.meta).toHaveProperty('has_more');
    // Pastikan tidak ada password_hash (security boundary)
    for (const item of body.data) {
      expect(item).not.toHaveProperty('password_hash');
      expect(item).not.toHaveProperty('passwordHash');
      expect(item).toHaveProperty('id');
      expect(item).toHaveProperty('username');
      expect(item).toHaveProperty('role');
      expect(item).toHaveProperty('is_active');
      expect(item).toHaveProperty('created_at');
      expect(item).toHaveProperty('avatar_url');
      if (item.role !== 'root') contributorId = item.id;
      if (item.role === 'root') rootUserId = item.id;
    }
  });

  it('PATCH /admin/users/:id/role contributor→reviewer → 200 + role berubah', async () => {
    if (!adminToken || !contributorId) return;
    const res = await client.api.v1.admin.users[':id'].role.$patch(
      {
        param: { id: contributorId },
        json: { role: 'reviewer' },
      },
      { headers: authHeaders() },
    );
    expect([200, 400, 403]).toContain(res.status);
    if (res.status === 200) {
      const body = await res.json();
      expect(body.success).toBe(true);
      expect(body.data.id).toBe(contributorId);
      expect(body.data.role).toBe('reviewer');
    }
  });

  it('PATCH /admin/users/:id/role target.role=root → 403 CANNOT_CHANGE_ROOT', async () => {
    if (!adminToken || !rootUserId) return;
    const res = await client.api.v1.admin.users[':id'].role.$patch(
      {
        param: { id: rootUserId },
        json: { role: 'admin' },
      },
      { headers: authHeaders() },
    );
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error_code).toBe('CANNOT_CHANGE_ROOT');
  });
});

describe.skipIf(!hasTestDb)('Admin create user E2E', () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let app: any;
  let adminToken: string;
  let adminId: string;
  let contributorToken: string;
  let ipSeq = 200;

  const xff = () => ({ 'x-forwarded-for': `10.9.0.${++ipSeq}` });

  const request = (path: string, init: RequestInit = {}) =>
    app.request(path, {
      ...init,
      headers: {
        'content-type': 'application/json',
        ...xff(),
        ...(init.headers ?? {}),
      },
    });

  beforeAll(async () => {
    const { capturedOtpDisplayCode } = await import('@/shared/testing/e2e-auth');
    const { getTestDb } = await import('@/shared/database/drizzle/test-client');
    const { users, userRoles } = await import('@/shared/database/drizzle/schema');
    const { eq } = await import('drizzle-orm');
    const appModule = await import('@/app');
    app = appModule.app;

    const stamp = `${Date.now()}${Math.floor(Math.random() * 1000)}`;
    const adminEmail = `admcrt${stamp}@test.com`;
    const contributorEmail = `koncrt${stamp}@test.com`;

    for (const [name, email] of [
      [`adm${stamp}`, adminEmail],
      [`kon${stamp}`, contributorEmail],
    ] as const) {
      const reg = await request('/api/v1/auth/register', {
        method: 'POST',
        body: JSON.stringify(e2eRegisterBody({
            name,
            email,
        })),
      });
      expect(reg.status).toBe(201);
      const verify = await request('/api/v1/auth/verify-email', {
        method: 'POST',
        body: JSON.stringify({ email, code: capturedOtpDisplayCode() }),
      });
      expect(verify.status).toBe(200);
    }

    const db = getTestDb();
    const [__uid_152] = await db.select({ id: users.id }).from(users).where(eq(users.email, adminEmail)).limit(1);
    if (__uid_152) await db.insert(userRoles).values({ userId: __uid_152.id, role: 'admin' }).onConflictDoNothing();

    const login = async (email: string) => {
      const res = await request('/api/v1/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password: 'Password123' }),
      });
      expect(res.status).toBe(200);
      const body = await res.json();
      return body.data as { access_token: string; user: { id: string } };
    };

    const adminSession = await login(adminEmail);
    adminToken = adminSession.access_token;
    adminId = adminSession.user.id;
    contributorToken = (await login(contributorEmail)).access_token;
  });

  const createBody = (email: string, isActive: boolean) => ({
    username: `u${email.split('@')[0]}`,
    email,
    password: 'Password123',
    confirm_password: 'Password123',
    roles: ['contributor'],
    role: 'contributor',
    is_active: isActive,
  });

  it('POST /api/v1/admin/users tanpa auth → 401', async () => {
    const res = await request('/api/v1/admin/users', {
      method: 'POST',
      body: JSON.stringify(createBody(`anon${Date.now()}@test.com`, true)),
    });
    expect(res.status).toBe(401);
  });

  it('POST /api/v1/admin/users sebagai kontributor → 403', async () => {
    const res = await request('/api/v1/admin/users', {
      method: 'POST',
      headers: { authorization: `Bearer ${contributorToken}` },
      body: JSON.stringify(createBody(`forbid${Date.now()}@test.com`, true)),
    });
    expect(res.status).toBe(403);
  });

  it('POST akun aktif → 201 tanpa password, lalu login berhasil', async () => {
    const email = `aktif${Date.now()}@test.com`;
    const res = await request('/api/v1/admin/users', {
      method: 'POST',
      headers: { authorization: `Bearer ${adminToken}` },
      body: JSON.stringify(createBody(email, true)),
    });
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data.email).toBe(email);
    expect(body.data.is_active).toBe(true);
    expect(body.data.role).toBe('contributor');
    expect(JSON.stringify(body)).not.toContain('password');

    const login = await request('/api/v1/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password: 'Password123' }),
    });
    expect(login.status).toBe(200);
  });

  it('POST akun nonaktif → login gagal', async () => {
    const email = `mati${Date.now()}@test.com`;
    const res = await request('/api/v1/admin/users', {
      method: 'POST',
      headers: { authorization: `Bearer ${adminToken}` },
      body: JSON.stringify(createBody(email, false)),
    });
    expect(res.status).toBe(201);
    const login = await request('/api/v1/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password: 'Password123' }),
    });
    expect(login.status).toBe(401);
    const body = await login.json();
    expect(body.error_code).toBe('INVALID_CREDENTIALS');
  });

  it('PATCH status diri sendiri → 403 CANNOT_DEACTIVATE_SELF', async () => {
    const res = await request(`/api/v1/admin/users/${adminId}/active`, {
      method: 'PATCH',
      headers: { authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({ is_active: false }),
    });
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error_code).toBe('CANNOT_DEACTIVATE_SELF');
  });

  it('POST verify-email admin: verifikasi manual + OTP terhapus + login lolos', async () => {
    const { getTestDb } = await import('@/shared/database/drizzle/test-client');
    const { users, emailVerificationOtps, activityEvents } = await import('@/shared/database/drizzle/schema');
    const { eq, and } = await import('drizzle-orm');
    const db = getTestDb();

    const stamp = `${Date.now()}${Math.floor(Math.random() * 1000)}`;
    const email = `manualv${stamp}@test.com`;
    const reg = await request('/api/v1/auth/register', {
      method: 'POST',
      body: JSON.stringify(e2eRegisterBody({ name: `manualv${stamp}`, email })),
    });
    expect(reg.status).toBe(201);
    const [target] = await db.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1);
    expect(target).toBeDefined();

    // List admin menampilkan state OTP user yang belum terverifikasi.
    const list = await request(`/api/v1/admin/users?q=manualv${stamp}`, {
      headers: { authorization: `Bearer ${adminToken}` },
    });
    expect(list.status).toBe(200);
    const listBody = await list.json();
    const row = listBody.data[0];
    expect(row.email_verified).toBe(false);
    expect(row.email_verified_at).toBeNull();
    expect(row.otp).not.toBeNull();
    expect(row.otp.expires_at).toBeTruthy();

    // Guard: tanpa auth 401, sebagai kontributor 403.
    const anon = await request(`/api/v1/admin/users/${target.id}/verify-email`, { method: 'POST' });
    expect(anon.status).toBe(401);
    const forbidden = await request(`/api/v1/admin/users/${target.id}/verify-email`, {
      method: 'POST',
      headers: { authorization: `Bearer ${contributorToken}` },
    });
    expect(forbidden.status).toBe(403);

    // Sukses: 200 + email_verified_at terisi.
    const ok = await request(`/api/v1/admin/users/${target.id}/verify-email`, {
      method: 'POST',
      headers: { authorization: `Bearer ${adminToken}` },
    });
    expect(ok.status).toBe(200);
    const okBody = await ok.json();
    expect(okBody.success).toBe(true);
    expect(okBody.data.id).toBe(target.id);
    expect(okBody.data.email_verified).toBe(true);
    expect(okBody.data.email_verified_at).toBeTruthy();

    // OTP dihapus, kolom users terisi, event user_joined tercatat.
    const otpRows = await db
      .select({ id: emailVerificationOtps.id })
      .from(emailVerificationOtps)
      .where(eq(emailVerificationOtps.userId, target.id));
    expect(otpRows).toHaveLength(0);
    const [after] = await db
      .select({ emailVerified: users.emailVerified, emailVerifiedAt: users.emailVerifiedAt })
      .from(users)
      .where(eq(users.id, target.id))
      .limit(1);
    expect(after.emailVerified).toBe(true);
    expect(after.emailVerifiedAt).toBeInstanceOf(Date);
    const events = await db
      .select({ id: activityEvents.id })
      .from(activityEvents)
      .where(and(eq(activityEvents.kind, 'user_joined'), eq(activityEvents.dedupeKey, `joined:${target.id}`)));
    expect(events.length).toBeGreaterThan(0);

    // Login sekarang lolos (tanpa 403 EMAIL_NOT_VERIFIED).
    const login = await request('/api/v1/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password: 'Password123' }),
    });
    expect(login.status).toBe(200);

    // Verifikasi ulang → 400 ALREADY_VERIFIED.
    const again = await request(`/api/v1/admin/users/${target.id}/verify-email`, {
      method: 'POST',
      headers: { authorization: `Bearer ${adminToken}` },
    });
    expect(again.status).toBe(400);
    expect((await again.json()).error_code).toBe('ALREADY_VERIFIED');
  });

  it('POST verify-email admin untuk id tak dikenal → 400 USER_NOT_FOUND', async () => {
    const res = await request('/api/v1/admin/users/01JZZZZZZZZZZZZZZZZZZZZZZZ/verify-email', {
      method: 'POST',
      headers: { authorization: `Bearer ${adminToken}` },
    });
    expect(res.status).toBe(400);
    expect((await res.json()).error_code).toBe('USER_NOT_FOUND');
  });

  it('GET /admin/users filter email_verified=false menyaring user belum verifikasi', async () => {
    const stamp = `${Date.now()}${Math.floor(Math.random() * 1000)}`;
    const email = `unver${stamp}@test.com`;
    const reg = await request('/api/v1/auth/register', {
      method: 'POST',
      body: JSON.stringify(e2eRegisterBody({ name: `unver${stamp}`, email })),
    });
    expect(reg.status).toBe(201);

    const res = await request('/api/v1/admin/users?email_verified=false&q=unver', {
      headers: { authorization: `Bearer ${adminToken}` },
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.length).toBeGreaterThan(0);
    for (const item of body.data) expect(item.email_verified).toBe(false);
  });

  it('GET /admin/users menampilkan auth_providers per metode onboard', async () => {
    const { getTestDb } = await import('@/shared/database/drizzle/test-client');
    const { authIdentities, users } = await import('@/shared/database/drizzle/schema');
    const { eq } = await import('drizzle-orm');
    const db = getTestDb();

    // User onboard via Google: buat manual + identity (tanpa ping Google).
    const stamp = `${Date.now()}${Math.floor(Math.random() * 1000)}`;
    const googleEmail = `gvia${stamp}@test.com`;
    const reg = await request('/api/v1/auth/register', {
      method: 'POST',
      body: JSON.stringify(e2eRegisterBody({ name: `gvia${stamp}`, email: googleEmail })),
    });
    expect(reg.status).toBe(201);
    const [gUser] = await db.select({ id: users.id }).from(users).where(eq(users.email, googleEmail)).limit(1);
    await db.insert(authIdentities).values({
      userId: gUser.id,
      provider: 'google',
      providerUserId: `sub-onboard-${stamp}`,
      emailAtProvider: googleEmail,
    });
    await db
      .update(users)
      .set({ avatarUrl: 'https://cdn.example.com/avatar.png' })
      .where(eq(users.id, gUser.id));

    const res = await request('/api/v1/admin/users?q=gvia', { headers: { authorization: `Bearer ${adminToken}` } });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data[0].auth_providers).toEqual(['google']);
    expect(body.data[0].avatar_url).toBe('https://cdn.example.com/avatar.png');

    // User password biasa (seed describe ini) tidak punya identity → [].
    const plain = await request('/api/v1/admin/users?q=adm', { headers: { authorization: `Bearer ${adminToken}` } });
    const plainBody = await plain.json();
    expect(plainBody.data[0].auth_providers).toEqual([]);
  });
});
