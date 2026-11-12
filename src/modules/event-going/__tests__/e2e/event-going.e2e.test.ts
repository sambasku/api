import { describe, it, expect, beforeAll } from 'vitest';
import { config } from 'dotenv';
import { and, eq, isNull } from 'drizzle-orm';
import {
  capturedOtpDisplayCode,
  e2eRegisterBody,
} from '@/shared/testing/e2e-auth';

const { parsed } = config({ path: '.env.test', quiet: true });
const hasTestDb = !!parsed?.DATABASE_URL;
if (parsed?.DATABASE_URL) process.env.DATABASE_URL = parsed.DATABASE_URL;

describe.skipIf(!hasTestDb)('Event Going E2E', () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let app: any;
  let adminToken: string;
  let userToken: string;
  let eventId: string;
  let eventSlug: string;

  const request = (path: string, init: RequestInit = {}) =>
    app.request(path, {
      ...init,
      headers: { 'content-type': 'application/json', ...(init.headers ?? {}) },
    });
  const post = (path: string, body?: unknown, token?: string) =>
    request(path, {
      method: 'POST',
      body: body === undefined ? undefined : JSON.stringify(body),
      headers: token ? { authorization: `Bearer ${token}` } : {},
    });
  const get = (path: string, token?: string) =>
    request(path, {
      headers: token ? { authorization: `Bearer ${token}` } : {},
    });
  const del = (path: string, token?: string) =>
    request(path, {
      method: 'DELETE',
      headers: token ? { authorization: `Bearer ${token}` } : {},
    });

  beforeAll(async () => {
    const { getTestDb } = await import('@/shared/database/drizzle/test-client');
    const { regions, userRoles, users } = await import(
      '@/shared/database/drizzle/schema'
    );
    const { truncateAll } = await import(
      '@/shared/database/drizzle/test-utils'
    );
    const db = getTestDb();
    await truncateAll(db);

    const KEC_ID = '01E2EGOINGKEC00000000001';
    const VILLAGE_ID = '01E2EGOINGDESA000000001';
    await db.insert(regions).values([
      {
        id: KEC_ID,
        slug: 'pemangkat-going',
        name: 'Pemangkat Going',
        type: 'kecamatan',
        status: 'published',
      },
      {
        id: VILLAGE_ID,
        slug: 'pemangkat-going/perapakan',
        name: 'Perapakan Going',
        type: 'desa',
        parentId: KEC_ID,
        status: 'published',
      },
    ]);

    const appModule = await import('@/app');
    app = appModule.app;

    const stamp = Date.now();
    await post(
      '/api/v1/auth/register',
      e2eRegisterBody({ name: `admg${stamp}`, email: `admg${stamp}@test.com` }),
    );
    await post('/api/v1/auth/verify-email', {
      email: `admg${stamp}@test.com`,
      code: capturedOtpDisplayCode(),
    });
    const [admin] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, `admg${stamp}@test.com`))
      .limit(1);
    if (admin) {
      await db
        .insert(userRoles)
        .values({ userId: admin.id, role: 'admin' })
        .onConflictDoNothing();
    }
    adminToken = (
      await (
        await post('/api/v1/auth/login', {
          email: `admg${stamp}@test.com`,
          password: 'Password123',
        })
      ).json()
    ).data.access_token;

    await post(
      '/api/v1/auth/register',
      e2eRegisterBody({ name: `usrg${stamp}`, email: `usrg${stamp}@test.com` }),
    );
    await post('/api/v1/auth/verify-email', {
      email: `usrg${stamp}@test.com`,
      code: capturedOtpDisplayCode(),
    });
    userToken = (
      await (
        await post('/api/v1/auth/login', {
          email: `usrg${stamp}@test.com`,
          password: 'Password123',
        })
      ).json()
    ).data.access_token;

    eventSlug = `pawai-going-${stamp}`;
    const created = await (
      await post(
        '/api/v1/admin/events',
        {
          slug: eventSlug,
          name: 'Pawai Going E2E',
          description: 'Acara untuk uji berencana datang.',
          category_id: 'budaya-tradisi',
          starts_at: new Date(Date.now() + 86_400_000).toISOString(),
          ends_at: new Date(Date.now() + 90_000_000).toISOString(),
          location_text: 'Lapangan Going',
          village_id: VILLAGE_ID,
          region_id: KEC_ID,
          status: 'published',
        },
        adminToken,
      )
    ).json();
    eventId = created.data.id;
  });

  it('tanpa token = 401', async () => {
    const res = await post(`/api/v1/events/${eventId}/going`);
    expect(res.status).toBe(401);
  });

  it('mark + detail viewer_going + admin WHO + unmark hide activity', async () => {
    const mark = await post(`/api/v1/events/${eventId}/going`, undefined, userToken);
    expect(mark.status).toBe(200);
    const marked = await mark.json();
    expect(marked.data.viewer_going).toBe(true);
    expect(marked.data.going_count).toBe(1);

    // Idempotent
    const mark2 = await post(`/api/v1/events/${eventId}/going`, undefined, userToken);
    expect(mark2.status).toBe(200);
    expect((await mark2.json()).data.going_count).toBe(1);

    const detail = await get(`/api/v1/events/${eventSlug}`, userToken);
    expect(detail.status).toBe(200);
    const body = await detail.json();
    expect(body.data.going_count).toBe(1);
    expect(body.data.viewer_going).toBe(true);

    const who = await get(`/api/v1/admin/events/${eventId}/goings`, adminToken);
    expect(who.status).toBe(200);
    const whoBody = await who.json();
    expect(whoBody.meta.total).toBe(1);
    expect(whoBody.data[0].username).toBeTruthy();

    const { getTestDb } = await import('@/shared/database/drizzle/test-client');
    const { activityEvents } = await import(
      '@/shared/database/drizzle/schema'
    );
    const db = getTestDb();
    const [act] = await db
      .select({
        id: activityEvents.id,
        hiddenAt: activityEvents.hiddenAt,
        kind: activityEvents.kind,
      })
      .from(activityEvents)
      .where(
        and(
          eq(activityEvents.kind, 'event_going'),
          eq(activityEvents.targetId, eventId),
          isNull(activityEvents.hiddenAt),
        ),
      )
      .limit(1);
    expect(act).toBeTruthy();

    const unmark = await del(`/api/v1/events/${eventId}/going`, userToken);
    expect(unmark.status).toBe(200);
    expect((await unmark.json()).data.viewer_going).toBe(false);

    const [hidden] = await db
      .select({ hiddenAt: activityEvents.hiddenAt })
      .from(activityEvents)
      .where(
        and(
          eq(activityEvents.kind, 'event_going'),
          eq(activityEvents.targetId, eventId),
        ),
      )
      .limit(1);
    expect(hidden?.hiddenAt).toBeTruthy();
  });

  it('tolak mark pada acara completed', async () => {
    const past = await (
      await post(
        '/api/v1/admin/events',
        {
          slug: `pawai-past-${Date.now()}`,
          name: 'Pawai Past',
          description: 'Sudah selesai.',
          category_id: 'budaya-tradisi',
          starts_at: new Date(Date.now() - 90_000_000).toISOString(),
          ends_at: new Date(Date.now() - 86_400_000).toISOString(),
          location_text: 'Lapangan Past',
          status: 'published',
        },
        adminToken,
      )
    ).json();
    const res = await post(
      `/api/v1/events/${past.data.id}/going`,
      undefined,
      userToken,
    );
    expect(res.status).toBe(400);
    expect((await res.json()).error_code).toBe('EVENT_COMPLETED');
  });
});
