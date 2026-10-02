import { describe, it, expect, beforeAll, afterEach, vi } from 'vitest';
import { config } from 'dotenv';
import { capturedOtpDisplayCode, E2E_LEGAL_CONSENTS } from '@/shared/testing/e2e-auth';

// Pastikan .env.test (DB test) dipakai SEBELUM app di-import -
// .env dev tidak boleh pernah tersentuh dari test (api-base-stack.md Section 10)
const { parsed } = config({ path: '.env.test', quiet: true });
const hasTestDb = !!parsed?.DATABASE_URL;
if (parsed?.DATABASE_URL) process.env.DATABASE_URL = parsed.DATABASE_URL;

describe.skipIf(!hasTestDb)('Auth refresh channel gate (issue #34)', () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let client: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let app: any;

  beforeAll(async () => {
    const { testClient } = await import('hono/testing');
    const appModule = await import('@/app');
    app = appModule.app;
    client = testClient(app as never);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  const unique = () => `gate+${Date.now()}${Math.floor(Math.random() * 1000)}@test.com`;

  // Rate-limiter keyed by x-forwarded-for - IP unik per call mengisolasi
  // bucket antar test (register 5/jam, login 5/15menit per IP)
  let ipSeq = 0;
  const xff = () => ({ 'x-forwarded-for': `10.0.0.${++ipSeq}` });

  const registerAndVerify = async (email: string) => {
    const registerRes = await client.api.v1.auth.register.$post(
      {
        json: {
          name: 'Gate Test',
          email,
          password: 'Password123',
          confirm_password: 'Password123',
          client_id: 'sambasku-web',
          consents: E2E_LEGAL_CONSENTS,
        },
      },
      { headers: xff() },
    );
    expect(registerRes.status).toBe(201);
    const verifyRes = await client.api.v1.auth['verify-email'].$post(
      { json: { email, code: capturedOtpDisplayCode() } },
      { headers: xff() },
    );
    expect(verifyRes.status).toBe(200);
  };

  const loginMobile = async (email: string) => {
    const res = await client.api.v1.auth.login.$post(
      { json: { email, password: 'Password123', client_type: 'mobile' } },
      { headers: xff() },
    );
    expect(res.status).toBe(200);
    return (await res.json()).data.refresh_token as string;
  };

  it('SEC: browser Origin + refresh_token body → 403 REFRESH_CHANNEL_NOT_ALLOWED', async () => {
    const email = unique();
    await registerAndVerify(email);
    const token = await loginMobile(email);

    const res = await client.api.v1.auth.refresh.$post(
      { json: { refresh_token: token } },
      {
        headers: {
          // fetch/XHR dari browser selalu kirim Origin (forbidden header)
          origin: 'https://sambasku.com',
        },
      },
    );
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error_code).toBe('REFRESH_CHANNEL_NOT_ALLOWED');
  });

  it('SEC: UA browser tanpa Origin + body → 403', async () => {
    const email = unique();
    await registerAndVerify(email);
    const token = await loginMobile(email);

    const res = await app.request('/api/v1/auth/refresh', {
      method: 'POST',
      body: JSON.stringify({ refresh_token: token }),
      headers: {
        'content-type': 'application/json',
        'user-agent':
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
        ...xff(),
      },
    });
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error_code).toBe('REFRESH_CHANNEL_NOT_ALLOWED');
  });

  it('SEC: browser + login client_type mobile → 403 (refresh token tak pernah sampai ke JS)', async () => {
    const email = unique();
    await registerAndVerify(email);
    const res = await client.api.v1.auth.login.$post(
      { json: { email, password: 'Password123', client_type: 'mobile' } },
      { headers: { origin: 'https://sambasku.com', ...xff() } },
    );
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error_code).toBe('REFRESH_CHANNEL_NOT_ALLOWED');
  });

  it('SEC: native (Dio, tanpa Origin) + body → 200 jalur mobile tetap aman', async () => {
    const email = unique();
    await registerAndVerify(email);
    const token = await loginMobile(email);

    const res = await client.api.v1.auth.refresh.$post(
      { json: { refresh_token: token } },
      { headers: { 'user-agent': 'Dio/5.4 (dart:io)' } },
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.refresh_token).toBeDefined();
    expect(body.data.refresh_token).not.toBe(token);
  });

  it('SEC: browser + cookie → 200 (jalur web sah)', async () => {
    const email = unique();
    await registerAndVerify(email);
    const loginRes = await client.api.v1.auth.login.$post(
      { json: { email, password: 'Password123' } },
      { headers: { origin: 'https://sambasku.com', ...xff() } },
    );
    expect(loginRes.status).toBe(200);
    const cookie = loginRes.headers
      .getSetCookie()
      .find((c: string) => /^refresh_token=[^;]+/.test(c));
    expect(cookie).toBeDefined();
    const token = cookie!.match(/refresh_token=([^;]+)/)![1];

    const res = await client.api.v1.auth.refresh.$post(undefined, {
      headers: { origin: 'https://sambasku.com', cookie: `refresh_token=${token}` },
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.access_token).toBeDefined();
  });
});
