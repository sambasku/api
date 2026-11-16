import { describe, it, expect, beforeAll } from 'vitest';
import { config } from 'dotenv';
import { eq } from 'drizzle-orm';
import { capturedOtpDisplayCode, e2eRegisterBody } from '@/shared/testing/e2e-auth';

const { parsed } = config({ path: '.env.test', quiet: true });
const hasTestDb = !!parsed?.DATABASE_URL;
if (parsed?.DATABASE_URL) process.env.DATABASE_URL = parsed.DATABASE_URL;

describe.skipIf(!hasTestDb)('Ensiklopedia E2E - atribusi penulis artikel', () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let app: any;
  let adminToken: string;
  let adminUsername: string;
  const stamp = Date.now();

  const post = async (path: string, body: unknown, token?: string) =>
    app.request(path, {
      method: 'POST',
      body: JSON.stringify(body),
      headers: {
        'content-type': 'application/json',
        ...(token ? { authorization: `Bearer ${token}` } : {}),
      },
    });

  beforeAll(async () => {
    const { getTestDb } = await import('@/shared/database/drizzle/test-client');
    const { truncateAll } = await import('@/shared/database/drizzle/test-utils');
    const { users, userRoles } = await import(
      '@/shared/database/drizzle/schema'
    );
    const db = getTestDb();
    await truncateAll(db);

    const appModule = await import('@/app');
    app = appModule.app;

    await post(
      '/api/v1/auth/register',
      e2eRegisterBody({ name: `adm${stamp}`, email: `adm${stamp}@test.com` }),
    );
    await post('/api/v1/auth/verify-email', {
      email: `adm${stamp}@test.com`,
      code: capturedOtpDisplayCode(),
    });
    const [uid] = await db
      .select({ id: users.id, username: users.username })
      .from(users)
      .where(eq(users.email, `adm${stamp}@test.com`))
      .limit(1);
    adminUsername = uid.username;
    await db
      .insert(userRoles)
      .values({ userId: uid.id, role: 'admin' })
      .onConflictDoNothing();
    adminToken = await (
      await post('/api/v1/auth/login', {
        email: `adm${stamp}@test.com`,
        password: 'Password123',
      })
    ).json().then((r: { data: { access_token: string } }) => r.data.access_token);

    await post(
      '/api/v1/admin/encyclopedia/categories',
      { id: 'sejarah', name: 'Sejarah' },
      adminToken,
    );
    await post(
      '/api/v1/admin/encyclopedia/articles',
      {
        title: 'Sejarah Istana Test',
        excerpt: 'Ringkasan.',
        body_md: '# Judul\n\nIsi.',
        category_id: 'sejarah',
        tags: [],
        status: 'published',
      },
      adminToken,
    );
  });

  it('detail publik berisi author live + is_verifier dari role', async () => {
    const detail = await (
      await app.request('/api/v1/encyclopedia/articles/sejarah-istana-test')
    ).json();
    const author = detail.data.author;
    expect(detail.success).toBe(true);
    expect(author.user_id).toBeTruthy();
    expect(author.username).toBe(adminUsername);
    expect(author.is_verifier).toBe(true);
  });
});
