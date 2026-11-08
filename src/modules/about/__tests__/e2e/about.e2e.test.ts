import { describe, it, expect, beforeAll } from 'vitest';
import { config } from 'dotenv';
import { eq } from 'drizzle-orm';
import { capturedOtpDisplayCode, e2eRegisterBody } from '@/shared/testing/e2e-auth';

const { parsed } = config({ path: '.env.test', quiet: true });
const hasTestDb = !!parsed?.DATABASE_URL;
if (parsed?.DATABASE_URL) process.env.DATABASE_URL = parsed.DATABASE_URL;

describe.skipIf(!hasTestDb)('About E2E - team / contributors / verifiers / sponsorships', () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let app: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let db: any;
  let adminToken: string;
  const stamp = Date.now();

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
  const get = (path: string) => request(path);

  beforeAll(async () => {
    const { getTestDb } = await import('@/shared/database/drizzle/test-client');
    const { userRoles, users } = await import('@/shared/database/drizzle/schema');
    db = getTestDb();
    const appModule = await import('@/app');
    app = appModule.app;

    const email = `adm-about${stamp}@test.com`;
    const name = `admabout${stamp}`;
    await post('/api/v1/auth/register', e2eRegisterBody({ name, email }));
    await post('/api/v1/auth/verify-email', {
      email,
      code: capturedOtpDisplayCode(),
    });
    const [uid] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, email))
      .limit(1);
    if (uid) {
      await db.insert(userRoles).values({ userId: uid.id, role: 'admin' }).onConflictDoNothing();
    }
    adminToken = (
      await (
        await post('/api/v1/auth/login', { email, password: 'Password123' })
      ).json()
    ).data.access_token;
  });

  it('team: is_team true muncul di GET /about/team', async () => {
    const { users } = await import('@/shared/database/drizzle/schema');
    const email = `team${stamp}@test.com`;
    const name = `team${stamp}`;
    await post('/api/v1/auth/register', e2eRegisterBody({ name, email }));
    await post('/api/v1/auth/verify-email', {
      email,
      code: capturedOtpDisplayCode(),
    });
    const [u] = await db.select().from(users).where(eq(users.username, name)).limit(1);
    await db
      .update(users)
      .set({ isTeam: true, teamAs: 'maintainer', teamNote: 'tester' })
      .where(eq(users.id, u.id));

    const res = await get('/api/v1/about/team');
    expect(res.status).toBe(200);
    const body = await res.json();
    const found = body.data.items.find((i: { username: string }) => i.username === name);
    expect(found).toMatchObject({
      username: name,
      team_as: 'maintainer',
      team_note: 'tester',
    });
  });

  it('verifiers: role reviewer masuk list', async () => {
    const { users, userRoles } = await import('@/shared/database/drizzle/schema');
    const email = `revabout${stamp}@test.com`;
    const name = `revabout${stamp}`;
    await post('/api/v1/auth/register', e2eRegisterBody({ name, email }));
    await post('/api/v1/auth/verify-email', {
      email,
      code: capturedOtpDisplayCode(),
    });
    const [u] = await db.select().from(users).where(eq(users.username, name)).limit(1);
    await db.delete(userRoles).where(eq(userRoles.userId, u.id));
    await db.insert(userRoles).values({ userId: u.id, role: 'reviewer' });

    const res = await get('/api/v1/users/verifiers');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.items.some((i: { username: string }) => i.username === name)).toBe(
      true,
    );
  });

  it('contributors: role contributor masuk list', async () => {
    const email = `ctrabout${stamp}@test.com`;
    const name = `ctrabout${stamp}`;
    await post('/api/v1/auth/register', e2eRegisterBody({ name, email }));
    await post('/api/v1/auth/verify-email', {
      email,
      code: capturedOtpDisplayCode(),
    });

    const res = await get('/api/v1/users/contributors?limit=100');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.items.some((i: { username: string }) => i.username === name)).toBe(
      true,
    );
    expect(body.data.total).toBeGreaterThanOrEqual(body.data.items.length);
  });

  it('sponsorship checkbox: check masuk publik, uncheck hilang', async () => {
    const { users } = await import('@/shared/database/drizzle/schema');
    const email = `spabout${stamp}@test.com`;
    const name = `spabout${stamp}`;
    await post('/api/v1/auth/register', e2eRegisterBody({ name, email }));
    await post('/api/v1/auth/verify-email', {
      email,
      code: capturedOtpDisplayCode(),
    });
    const [u] = await db.select().from(users).where(eq(users.username, name)).limit(1);

    const on = await patch(
      `/api/v1/admin/users/${u.id}/sponsor`,
      { is_sponsor: true },
      adminToken,
    );
    expect(on.status).toBe(200);

    let list = await get('/api/v1/about/sponsorships');
    let body = await list.json();
    expect(
      body.data.items.some((i: { username: string | null }) => i.username === name),
    ).toBe(true);

    const off = await patch(
      `/api/v1/admin/users/${u.id}/sponsor`,
      { is_sponsor: false },
      adminToken,
    );
    expect(off.status).toBe(200);

    list = await get('/api/v1/about/sponsorships');
    body = await list.json();
    expect(
      body.data.items.some((i: { username: string | null }) => i.username === name),
    ).toBe(false);
  });
});
