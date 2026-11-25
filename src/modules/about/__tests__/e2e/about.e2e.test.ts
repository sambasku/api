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


  const registerVerified = async (name: string, email: string) => {
    const reg = await post('/api/v1/auth/register', e2eRegisterBody({ name, email }));
    expect(reg.status).toBe(201);
    const ver = await post('/api/v1/auth/verify-email', {
      email,
      code: capturedOtpDisplayCode(),
    });
    expect(ver.status).toBe(200);
    const { users } = await import('@/shared/database/drizzle/schema');
    const [row] = await db
      .select({ id: users.id, username: users.username })
      .from(users)
      .where(eq(users.email, email))
      .limit(1);
    expect(row).toBeTruthy();
    return row!;
  };

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
    const u = await registerVerified(name, email);
    await db
      .update(users)
      .set({ isTeam: true, teamAs: 'maintainer', teamNote: 'tester' })
      .where(eq(users.id, u.id));

    const res = await get('/api/v1/about/team');
    expect(res.status).toBe(200);
    const body = await res.json();
    const found = body.data.items.find((i: { username: string }) => i.username === u.username);
    expect(found).toMatchObject({
      username: u.username,
      team_as: 'maintainer',
      team_note: 'tester',
    });
  });

  it('team: urutan team_sort_order ascending, null di belakang', async () => {
    const { users } = await import('@/shared/database/drizzle/schema');
    const stamp2 = Date.now();
    const mk = async (uname: string, sort: number | null) => {
      const email = `${uname}${stamp2}@test.com`;
      const u = await registerVerified(uname, email);
      await db
        .update(users)
        .set({
          isTeam: true,
          teamAs: 'tim',
          teamNote: uname,
          teamSortOrder: sort,
        })
        .where(eq(users.id, u.id));
      return u.username;
    };
    const late = await mk(`teamlater${stamp2}`, null);
    const first = await mk(`teamfirst${stamp2}`, 1);
    const second = await mk(`teamsecond${stamp2}`, 2);

    const res = await get('/api/v1/about/team');
    expect(res.status).toBe(200);
    const items = (await res.json()).data.items as { username: string }[];
    const ours = items
      .map((i) => i.username)
      .filter((u) => [late, first, second].includes(u));
    expect(ours).toEqual([first, second, late]);
  });

  it('verifiers: role reviewer masuk list', async () => {
    const { userRoles } = await import('@/shared/database/drizzle/schema');
    const email = `revabout${stamp}@test.com`;
    const name = `revabout${stamp}`;
    const u = await registerVerified(name, email);
    await db.delete(userRoles).where(eq(userRoles.userId, u.id));
    await db.insert(userRoles).values({ userId: u.id, role: 'reviewer' });

    const res = await get('/api/v1/users/verifiers?limit=50');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(typeof body.data.has_more).toBe('boolean');
    expect(body.data.items.some((i: { username: string }) => i.username === u.username)).toBe(
      true,
    );
  });

  it('contributors: role contributor masuk list', async () => {
    const email = `ctrabout${stamp}@test.com`;
    const name = `ctrabout${stamp}`;
    const u = await registerVerified(name, email);

    const res = await get('/api/v1/users/contributors?limit=100');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.items.some((i: { username: string }) => i.username === u.username)).toBe(
      true,
    );
  });

  it('sponsorship checkbox: check masuk publik, uncheck hilang', async () => {
    const email = `spabout${stamp}@test.com`;
    const name = `spabout${stamp}`;
    const u = await registerVerified(name, email);

    const on = await patch(
      `/api/v1/admin/users/${u.id}/sponsor`,
      { is_sponsor: true },
      adminToken,
    );
    expect(on.status).toBe(200);

    let list = await get('/api/v1/about/sponsorships');
    let body = await list.json();
    expect(
      body.data.items.some((i: { username: string | null }) => i.username === u.username),
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
      body.data.items.some((i: { username: string | null }) => i.username === u.username),
    ).toBe(false);
  });


  it('sponsorships: tier / usaha / splash + sponsor_tier usaha', async () => {
    const { regions } = await import('@/shared/database/drizzle/schema');
    const kecId = '01SPONSORE2EKEC00000001';
    const desaId = '01SPONSORE2EDESA0000001';
    await db
      .insert(regions)
      .values([
        {
          id: kecId,
          slug: `sponsor-kec-${stamp}`,
          name: 'Sponsor Kec',
          type: 'kecamatan',
          status: 'published',
        },
        {
          id: desaId,
          slug: `sponsor-kec-${stamp}/desa`,
          name: 'Sponsor Desa',
          type: 'desa',
          parentId: kecId,
          status: 'published',
        },
      ])
      .onConflictDoNothing();

    const usahaBody = (slug: string, name: string) => ({
      slug,
      name,
      description: 'Usaha sponsor e2e',
      category_id: 'kuliner',
      kind: 'product',
      region_id: kecId,
      village_id: desaId,
      publish_status: 'published',
      operational_status: 'open',
    });

    const uMustika = await post(
      '/api/v1/admin/usaha',
      usahaBody(`sponsor-mustika-${stamp}`, `Sponsor Mustika ${stamp}`),
      adminToken,
    );
    expect(uMustika.status).toBe(200);
    const mustikaUsaha = (await uMustika.json()).data as { id: string; slug: string };

    const uPerak = await post(
      '/api/v1/admin/usaha',
      usahaBody(`sponsor-perak-${stamp}`, `Sponsor Perak ${stamp}`),
      adminToken,
    );
    expect(uPerak.status).toBe(200);
    const perakUsaha = (await uPerak.json()).data as { id: string; slug: string };

    const today = new Date().toISOString().slice(0, 10);

    // 1) Tanpa FK
    const noFk = await post(
      '/api/v1/admin/sponsorships',
      {
        name: `Org NoFK ${stamp}`,
        since: today,
        tier: 'emas',
        logo_url: 'https://cdn.example.com/nofk.png',
      },
      adminToken,
    );
    expect(noFk.status).toBe(200);

    // 2) Usaha + Mustika → splash + lencana
    const mustikaSp = await post(
      '/api/v1/admin/sponsorships',
      {
        name: `Usaha Mustika ${stamp}`,
        since: today,
        tier: 'mustika',
        usaha_id: mustikaUsaha.id,
        logo_url: 'https://cdn.example.com/mustika.png',
      },
      adminToken,
    );
    expect(mustikaSp.status).toBe(200);

    // 3) Usaha + Perak → lencana, bukan splash
    const perakSp = await post(
      '/api/v1/admin/sponsorships',
      {
        name: `Usaha Perak ${stamp}`,
        since: today,
        tier: 'perak',
        usaha_id: perakUsaha.id,
        logo_url: 'https://cdn.example.com/perak.png',
      },
      adminToken,
    );
    expect(perakSp.status).toBe(200);

    // 4) User saja - pakai akun checkbox test (sponsor sudah di-off, unik index longgar)
    const { users } = await import('@/shared/database/drizzle/schema');
    const sponsorEmail = `spabout${stamp}@test.com`;
    const [sponsorUser] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, sponsorEmail))
      .limit(1);
    expect(sponsorUser).toBeTruthy();
    const userOnly = await post(
      '/api/v1/admin/sponsorships',
      {
        name: `User Only ${stamp}`,
        since: today,
        tier: 'intan',
        user_id: sponsorUser.id,
        logo_url: 'https://cdn.example.com/user.png',
      },
      adminToken,
    );
    expect(userOnly.status).toBe(200);
    expect((await userOnly.json()).data.usaha_id).toBeNull();

    const splash = await get('/api/v1/about/sponsorships/splash');
    expect(splash.status).toBe(200);
    const splashItems = (await splash.json()).data.items as Array<{
      name: string;
      tier: string;
      usaha_id: string | null;
    }>;
    expect(splashItems.some((i) => i.name === `Usaha Mustika ${stamp}`)).toBe(true);
    expect(splashItems.some((i) => i.name === `Usaha Perak ${stamp}`)).toBe(false);
    expect(splashItems.some((i) => i.name === `Org NoFK ${stamp}`)).toBe(false);
    expect(splashItems.some((i) => i.name === `User Only ${stamp}`)).toBe(false);

    const pub = await get('/api/v1/about/sponsorships');
    const pubItems = (await pub.json()).data.items as Array<{ name: string }>;
    expect(pubItems.some((i) => i.name === `Org NoFK ${stamp}`)).toBe(true);
    expect(pubItems.some((i) => i.name === `User Only ${stamp}`)).toBe(true);
    expect(pubItems.some((i) => i.name === `Usaha Perak ${stamp}`)).toBe(true);

    const detailMustika = await get(`/api/v1/usaha/${mustikaUsaha.slug}`);
    expect(detailMustika.status).toBe(200);
    expect((await detailMustika.json()).data.sponsor_tier).toBe('mustika');

    const detailPerak = await get(`/api/v1/usaha/${perakUsaha.slug}`);
    expect(detailPerak.status).toBe(200);
    expect((await detailPerak.json()).data.sponsor_tier).toBe('perak');

    const list = await get('/api/v1/usaha?limit=100');
    const listItems = (await list.json()).data.items as Array<{
      slug: string;
      sponsor_tier: string | null;
    }>;
    expect(
      listItems.find((i) => i.slug === mustikaUsaha.slug)?.sponsor_tier,
    ).toBe('mustika');
    expect(listItems.find((i) => i.slug === perakUsaha.slug)?.sponsor_tier).toBe(
      'perak',
    );
  });

});
