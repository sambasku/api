import { describe, it, expect, beforeAll } from "vitest";
import { config } from "dotenv";
import {
  capturedOtpDisplayCode,
  e2eRegisterBody,
} from "@/shared/testing/e2e-auth";
import { eq } from "drizzle-orm";

const { parsed } = config({ path: ".env.test", quiet: true });
const hasTestDb = !!parsed?.DATABASE_URL;
if (parsed?.DATABASE_URL) process.env.DATABASE_URL = parsed.DATABASE_URL;

/**
 * Metrik popularitas wisata (place_views):
 * - POST /places/:slug/view = 1 view per PEMBACA per hari WIB (dedupe server):
 *   user login (u:) > X-Device-Id (d:) > IP (ip:); refresh berulang = 1 baris
 * - slug tak dikenal / draft = no-op (tidak ada baris)
 * - GET /admin/places/views = total per place
 * - GET /admin/places/views/daily = tren harian + ranking
 */
describe.skipIf(!hasTestDb)("Place views E2E - counter + agregasi", () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let app: any;
  let adminToken: string;

  const request = (path: string, init: RequestInit = {}) =>
    app.request(path, {
      ...init,
      headers: { "content-type": "application/json", ...(init.headers ?? {}) },
    });
  const post = (path: string, body: unknown, token?: string) =>
    request(path, {
      method: "POST",
      body: JSON.stringify(body),
      headers: token ? { authorization: `Bearer ${token}` } : {},
    });
  const get = (path: string, token?: string) =>
    request(path, {
      headers: token ? { authorization: `Bearer ${token}` } : {},
    });

  beforeAll(async () => {
    const { getTestDb } = await import("@/shared/database/drizzle/test-client");
    const { users, userRoles, places, placeViews } =
      await import("@/shared/database/drizzle/schema");
    const { truncateAll } =
      await import("@/shared/database/drizzle/test-utils");
    const db = getTestDb();
    await truncateAll(db);

    const appModule = await import("@/app");
    app = appModule.app;

    const stamp = Date.now();
    await post(
      "/api/v1/auth/register",
      e2eRegisterBody({ name: `adm${stamp}`, email: `adm${stamp}@test.com` }),
    );
    await post("/api/v1/auth/verify-email", {
      email: `adm${stamp}@test.com`,
      code: capturedOtpDisplayCode(),
    });
    const [uid] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, `adm${stamp}@test.com`))
      .limit(1);
    if (uid)
      await db
        .insert(userRoles)
        .values({ userId: uid.id, role: "admin" })
        .onConflictDoNothing();
    adminToken = (
      await (
        await post("/api/v1/auth/login", {
          email: `adm${stamp}@test.com`,
          password: "Password123",
        })
      ).json()
    ).data.access_token;

    await db.insert(places).values([
      {
        id: "01E2EPLACEPUBLISH000001",
        slug: "wisata-publik-e2e",
        name: "Wisata Publik",
        category: "wisata",
        shortDescription: "Tempat published untuk uji view.",
        status: "published",
      },
      {
        id: "01E2EPLACEDRAFT0000001",
        slug: "wisata-draft-e2e",
        name: "Wisata Draft",
        category: "wisata",
        shortDescription: "Draft tidak boleh dihitung.",
        status: "draft",
      },
    ]);
    void placeViews;
  });

  const view = (headers: Record<string, string> = {}) =>
    request("/api/v1/places/wisata-publik-e2e/view", {
      method: "POST",
      body: "{}",
      headers,
    });
  const viewRows = async () => {
    const { getTestDb } = await import("@/shared/database/drizzle/test-client");
    const { placeViews } = await import("@/shared/database/drizzle/schema");
    return getTestDb().select().from(placeViews);
  };

  it("refresh berkali-kali oleh pembaca sama = 1 baris; beda pembaca = baris baru", async () => {
    const devA = { "x-device-id": "device-aaaaaaaa" };
    for (let i = 0; i < 3; i++) expect((await view(devA)).status).toBe(200);
    expect(await viewRows()).toHaveLength(1);

    // Device lain = pembaca lain.
    expect((await view({ "x-device-id": "device-bbbbbbbb" })).status).toBe(200);
    expect(await viewRows()).toHaveLength(2);

    // User login dihitung per user, device id diabaikan; 2x = 1 baris.
    const auth = { authorization: `Bearer ${adminToken}`, ...devA };
    expect((await view(auth)).status).toBe(200);
    expect((await view(auth)).status).toBe(200);
    expect(await viewRows()).toHaveLength(3);

    // Tanpa device id: fallback ke IP; 2x dari IP sama = 1 baris.
    const ip = { "cf-connecting-ip": "203.0.113.7" };
    expect((await view(ip)).status).toBe(200);
    expect((await view(ip)).status).toBe(200);

    // Token basi/rusak tidak boleh 401 (soft auth) - jatuh ke device id.
    const stale = { authorization: "Bearer rusak", "x-device-id": "device-cccccccc" };
    expect((await view(stale)).status).toBe(200);

    const rows = await viewRows();
    expect(rows).toHaveLength(5);
    expect(rows.every((r) => r.placeId === "01E2EPLACEPUBLISH000001")).toBe(true);
    expect(rows.map((r) => r.viewerKey).sort()).toEqual(
      [
        "d:device-aaaaaaaa",
        "d:device-bbbbbbbb",
        "d:device-cccccccc",
        "ip:203.0.113.7",
        expect.stringMatching(/^u:/),
      ].sort((x, y) => String(x).localeCompare(String(y))),
    );
  });

  it("slug tak dikenal dan place draft tidak tercatat", async () => {
    expect((await post("/api/v1/places/tidak-ada-e2e/view", {})).status).toBe(
      200,
    );
    expect(
      (await post("/api/v1/places/wisata-draft-e2e/view", {})).status,
    ).toBe(200);

    const { getTestDb } = await import("@/shared/database/drizzle/test-client");
    const { placeViews } = await import("@/shared/database/drizzle/schema");
    const db = getTestDb();
    const rows = await db.select().from(placeViews);
    expect(rows).toHaveLength(5);
    expect(rows.every((r) => r.placeId === "01E2EPLACEPUBLISH000001")).toBe(true);
  });

  it("GET /admin/places/views = total per place", async () => {
    const res = await get("/api/v1/admin/places/views?days=30", adminToken);
    expect(res.status).toBe(200);
    const body = (await res.json()).data as {
      items: Array<{ place_id: string; views: number }>;
    };
    const row = body.items.find(
      (i) => i.place_id === "01E2EPLACEPUBLISH000001",
    );
    expect(row?.views).toBe(5);
    expect(
      body.items.some((i) => i.place_id === "01E2EPLACEDRAFT0000001"),
    ).toBe(false);
  });

  it("GET /admin/places/views/daily = tren harian + ranking per place", async () => {
    const res = await get(
      "/api/v1/admin/places/views/daily?days=7",
      adminToken,
    );
    expect(res.status).toBe(200);
    const body = (await res.json()).data as {
      trend: Array<{ day: string; total: number }>;
      items: Array<{
        placeId: string;
        name: string;
        slug: string;
        views: number;
        lastViewed: string | null;
      }>;
    };
    expect(body.trend.length).toBeGreaterThan(0);
    expect(body.trend.reduce((s, p) => s + p.total, 0)).toBe(5);
    expect(body.items[0]).toMatchObject({
      placeId: "01E2EPLACEPUBLISH000001",
      name: "Wisata Publik",
      slug: "wisata-publik-e2e",
      views: 5,
    });
    expect(body.items[0].lastViewed).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("role gate: tanpa token 401, editor 403", async () => {
    expect((await get("/api/v1/admin/places/views")).status).toBe(401);

    const { getTestDb } = await import("@/shared/database/drizzle/test-client");
    const { users, userRoles } =
      await import("@/shared/database/drizzle/schema");
    const db = getTestDb();
    const stamp = Date.now();
    await post(
      "/api/v1/auth/register",
      e2eRegisterBody({ name: `edt${stamp}`, email: `edt${stamp}@test.com` }),
    );
    await post("/api/v1/auth/verify-email", {
      email: `edt${stamp}@test.com`,
      code: capturedOtpDisplayCode(),
    });
    const [edUid] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, `edt${stamp}@test.com`))
      .limit(1);
    if (edUid) {
      await db
        .insert(userRoles)
        .values({ userId: edUid.id, role: "editor" })
        .onConflictDoNothing();
    }
    const editorToken = (
      await (
        await post("/api/v1/auth/login", {
          email: `edt${stamp}@test.com`,
          password: "Password123",
        })
      ).json()
    ).data.access_token;
    expect((await get("/api/v1/admin/places/views", editorToken)).status).toBe(
      403,
    );
    expect(
      (await get("/api/v1/admin/places/views/daily", editorToken)).status,
    ).toBe(403);
  });
});
