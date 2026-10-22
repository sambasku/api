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
 * - POST /places/:slug/view = +1 view per hari WIB (upsert, bukan baris baru)
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

  it("POST view berulang = count naik di baris yang sama (upsert per hari)", async () => {
    expect(
      (await post("/api/v1/places/wisata-publik-e2e/view", {})).status,
    ).toBe(200);
    expect(
      (await post("/api/v1/places/wisata-publik-e2e/view", {})).status,
    ).toBe(200);
    expect(
      (await post("/api/v1/places/wisata-publik-e2e/view", {})).status,
    ).toBe(200);

    const { getTestDb } = await import("@/shared/database/drizzle/test-client");
    const { placeViews } = await import("@/shared/database/drizzle/schema");
    const db = getTestDb();
    const rows = await db.select().from(placeViews);
    expect(rows).toHaveLength(1);
    expect(rows[0].count).toBe(3);
    expect(rows[0].placeId).toBe("01E2EPLACEPUBLISH000001");
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
    expect(rows).toHaveLength(1);
    expect(rows[0].placeId).toBe("01E2EPLACEPUBLISH000001");
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
    expect(row?.views).toBe(3);
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
    expect(body.trend.reduce((s, p) => s + p.total, 0)).toBe(3);
    expect(body.items[0]).toMatchObject({
      placeId: "01E2EPLACEPUBLISH000001",
      name: "Wisata Publik",
      slug: "wisata-publik-e2e",
      views: 3,
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
