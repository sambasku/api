import { describe, it, expect, beforeAll } from "vitest";
import { config } from "dotenv";
import { eq } from "drizzle-orm";
import {
  capturedOtpDisplayCode,
  e2eRegisterBody,
} from "@/shared/testing/e2e-auth";

const { parsed } = config({ path: ".env.test", quiet: true });
const hasTestDb = !!parsed?.DATABASE_URL;
if (parsed?.DATABASE_URL) process.env.DATABASE_URL = parsed.DATABASE_URL;

/**
 * E2E modul event/acara:
 * - admin CRUD event (create/publish/cancel/soft-delete)
 * - usulan publik anonim -> pending -> approve jadi event published
 * - request revision -> status needs_revision -> resubmit
 * - reject dengan alasan
 * - otorisasi: list publik tidak bocorkan draft, admin route butuh token
 */
describe.skipIf(!hasTestDb)("Event E2E - CRUD admin + usulan moderasi", () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let app: any;
  let adminToken: string;
  let userToken: string;

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
  const put = (path: string, body: unknown, token?: string) =>
    request(path, {
      method: "PUT",
      body: JSON.stringify(body),
      headers: token ? { authorization: `Bearer ${token}` } : {},
    });
  const get = (path: string, token?: string) =>
    request(path, {
      headers: token ? { authorization: `Bearer ${token}` } : {},
    });
  const del = (path: string, token?: string) =>
    request(path, {
      method: "DELETE",
      headers: token ? { authorization: `Bearer ${token}` } : {},
    });

  const VILLAGE_ID = "01E2EREGIONDESA000000001";
  const KEC_ID = "01E2EREGIONKEC0000000001";

  const eventBody = (over: Record<string, unknown> = {}) => ({
    slug: "pawai-blocks-e2e",
    name: "Pawai Blocks Keywords E2E",
    description: "Acara pawai_blocks keywords untuk uji e2e.",
    category_id: "budaya-tradisi",
    starts_at: new Date(Date.now() + 86_400_000).toISOString(),
    ends_at: new Date(Date.now() + 90_000_000).toISOString(),
    location_text: "Lapangan utama Pemangkat",
    organizer: "Panitia Pawai E2E",
    source_url: "https://facebook.com/pawai.blocks.e2e",
    source_type: "facebook",
    source_attribution: "@panitia_pawai",
    village_id: VILLAGE_ID,
    region_id: KEC_ID,
    ...over,
  });

  beforeAll(async () => {
    const { getTestDb } = await import("@/shared/database/drizzle/test-client");
    const { regions, userRoles, users } = await import(
      "@/shared/database/drizzle/schema"
    );
    const { truncateAll } = await import(
      "@/shared/database/drizzle/test-utils"
    );
    const db = getTestDb();
    await truncateAll(db);

    await db.insert(regions).values([
      {
        id: KEC_ID,
        slug: "pemangkat",
        name: "Pemangkat",
        type: "kecamatan",
        status: "published",
      },
      {
        id: VILLAGE_ID,
        slug: "pemangkat/perapakan",
        name: "Perapakan",
        type: "desa",
        parentId: KEC_ID,
        status: "published",
      },
    ]);

    const appModule = await import("@/app");
    app = appModule.app;

    const stamp = Date.now();
    await post(
      "/api/v1/auth/register",
      e2eRegisterBody({ name: `adme${stamp}`, email: `adme${stamp}@test.com` }),
    );
    await post("/api/v1/auth/verify-email", {
      email: `adme${stamp}@test.com`,
      code: capturedOtpDisplayCode(),
    });
    const [uid] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, `adme${stamp}@test.com`))
      .limit(1);
    if (uid)
      await db
        .insert(userRoles)
        .values({ userId: uid.id, role: "admin" })
        .onConflictDoNothing();
    adminToken = (
      await (
        await post("/api/v1/auth/login", {
          email: `adme${stamp}@test.com`,
          password: "Password123",
        })
      ).json()
    ).data.access_token;

    await post(
      "/api/v1/auth/register",
      e2eRegisterBody({ name: `usre${stamp}`, email: `usre${stamp}@test.com` }),
    );
    await post("/api/v1/auth/verify-email", {
      email: `usre${stamp}@test.com`,
      code: capturedOtpDisplayCode(),
    });
    userToken = (
      await (
        await post("/api/v1/auth/login", {
          email: `usre${stamp}@test.com`,
          password: "Password123",
        })
      ).json()
    ).data.access_token;
  });

  it("admin buat event published -> tampil di list & detail publik", async () => {
    const res = await post("/api/v1/admin/events", eventBody(), adminToken);
    expect(res.status).toBe(200);
    const created = (await res.json()).data;
    expect(created.slug).toBe("pawai-blocks-e2e");
    expect(created.status).toBe("published");
    expect(created.occurrence_status).toBe("upcoming");
    expect(created.organizer).toBe("Panitia Pawai E2E");
    expect(created.source_url).toBe("https://facebook.com/pawai.blocks.e2e");
    expect(created.source_type).toBe("facebook");
    expect(created.village?.name).toBe("Perapakan");
    expect(created.category?.name).toBe("Budaya dan Tradisi");

    const list = await get("/api/v1/events");
    expect(list.status).toBe(200);
    const items = (await list.json()).data.items;
    expect(items.some((e: { slug: string }) => e.slug === "pawai-blocks-e2e")).toBe(
      true,
    );

    const detail = await get("/api/v1/events/pawai-blocks-e2e");
    expect(detail.status).toBe(200);
    expect((await detail.json()).data.id).toBe(created.id);
  });

  it("poster_urls multi gambar: tersimpan urut, [0] sampul, tolak >10", async () => {
    const posters = Array.from(
      { length: 3 },
      (_, i) => `https://cdn.example.com/poster-${i + 1}.webp`,
    );
    const res = await post(
      "/api/v1/admin/events",
      eventBody({ slug: "multi-poster-e2e", poster_urls: posters }),
      adminToken,
    );
    expect(res.status).toBe(200);
    const created = (await res.json()).data;
    expect(created.poster_urls).toEqual(posters);

    // Detail publik juga membawa array urut.
    const detail = await get("/api/v1/events/multi-poster-e2e");
    expect(detail.status).toBe(200);
    expect((await detail.json()).data.poster_urls).toEqual(posters);

    // Usulan anonim membawa poster_urls -> payload tersimpan utuh.
    const submit = await post(
      "/api/v1/event-contributions",
      eventBody({ slug: "diabaikan", poster_urls: posters.slice(0, 2) }),
    );
    expect(submit.status).toBe(200);
    expect((await submit.json()).data.payload.poster_urls).toEqual(
      posters.slice(0, 2),
    );

    // Lebih dari 10 poster ditolak validasi.
    const overflow = await post(
      "/api/v1/admin/events",
      eventBody({
        slug: "poster-overflow-e2e",
        poster_urls: Array.from(
          { length: 11 },
          (_, i) => `https://cdn.example.com/too-many-${i}.webp`,
        ),
      }),
      adminToken,
    );
    expect(overflow.status).toBe(400);
  });

  it("katalog kategori acara: publik hanya published, admin boleh semua", async () => {
    const pub = await get("/api/v1/events/categories");
    expect(pub.status).toBe(200);
    const pubItems = (await pub.json()).data.items as Array<{
      id: string;
      name: string;
    }>;
    expect(pubItems.length).toBeGreaterThan(0);
    expect(pubItems.some((c) => c.id === "budaya-tradisi")).toBe(true);
    expect(pubItems.every((c) => c.name.trim().length > 0)).toBe(true);

    const admin = await get("/api/v1/admin/events/categories", adminToken);
    expect(admin.status).toBe(200);
    const adminItems = (await admin.json()).data.items as Array<{ id: string }>;
    expect(adminItems.length).toBeGreaterThanOrEqual(pubItems.length);
  });

  it("tolak jadwal salah (ends < starts) dan slug bentrok", async () => {
    const bad = await post(
      "/api/v1/admin/events",
      eventBody({
        slug: "jadwal-salah-e2e",
        starts_at: new Date(Date.now() + 90_000_000).toISOString(),
        ends_at: new Date(Date.now() + 86_400_000).toISOString(),
      }),
      adminToken,
    );
    expect(bad.status).toBe(400);

    const dup = await post(
      "/api/v1/admin/events",
      eventBody({ name: "Duplikat" }),
      adminToken,
    );
    expect(dup.status).toBe(409);
  });

  it("draft tidak bocor ke list publik tapi ada di list admin", async () => {
    const created = await post(
      "/api/v1/admin/events",
      eventBody({ slug: "rahasia-draft-e2e", name: "Draft Rahasia", status: "draft" }),
      adminToken,
    );
    expect(created.status).toBe(200);

    const pub = await get("/api/v1/events?limit=100");
    const pubItems = (await pub.json()).data.items;
    expect(
      pubItems.some((e: { slug: string }) => e.slug === "rahasia-draft-e2e"),
    ).toBe(false);

    const admin = await get("/api/v1/admin/events?limit=100", adminToken);
    expect(admin.status).toBe(200);
    const adminItems = (await admin.json()).data.items;
    expect(
      adminItems.some((e: { slug: string }) => e.slug === "rahasia-draft-e2e"),
    ).toBe(true);
  });

  it("route admin butuh token", async () => {
    const res = await get("/api/v1/admin/events");
    expect(res.status).toBe(401);
  });

  it("usulan anonim -> pending -> approve -> event published", async () => {
    const submit = await post(
      "/api/v1/event-contributions",
      eventBody({ slug: "diabaikan-untuk-usulan" }),
    );
    expect(submit.status).toBe(200);
    const row = (await submit.json()).data;
    expect(row.status).toBe("pending");
    expect(row.payload.source_url).toBe("https://facebook.com/pawai.blocks.e2e");

    const pending = await get("/api/v1/admin/event-contributions", adminToken);
    expect(pending.status).toBe(200);
    const pendingItems = (await pending.json()).data.items;
    expect(pendingItems.some((r: { id: string }) => r.id === row.id)).toBe(true);

    const approve = await post(
      `/api/v1/admin/event-contributions/${row.id}/approve`,
      {},
      adminToken,
    );
    expect(approve.status).toBe(200);

    // Usulan approved -> event published dengan slug unik dari nama.
    const list = await get("/api/v1/events?limit=100");
    const items = (await list.json()).data.items;
    const created = items.find(
      (e: { name: string }) => e.name === "Pawai Blocks Keywords E2E",
    );
    expect(created).toBeTruthy();
    expect(created?.status).toBe("published");
    expect(created?.source_attribution).toBe("@panitia_pawai");
  });

  it("request revision -> needs_revision -> resubmit jadi pending", async () => {
    const submit = await post(
      "/api/v1/event-contributions",
      eventBody({ name: "Acara Revisi E2E" }),
      userToken,
    );
    const row = (await submit.json()).data;

    const revision = await post(
      `/api/v1/admin/event-contributions/${row.id}/request-revision`,
      { note: "Jadwalnya belum jelas, perbaiki ya." },
      adminToken,
    );
    expect(revision.status).toBe(200);

    const mine = await get("/api/v1/event-contributions/mine", userToken);
    const mineItems = (await mine.json()).data.items;
    const mineRow = mineItems.find((r: { id: string }) => r.id === row.id);
    expect(mineRow?.status).toBe("needs_revision");
    expect(mineRow?.revision_note).toBe("Jadwalnya belum jelas, perbaiki ya.");

    const resubmit = await put(
      `/api/v1/event-contributions/${row.id}`,
      eventBody({ name: "Acara Revisi E2E" }),
      userToken,
    );
    expect(resubmit.status).toBe(200);
    expect((await resubmit.json()).data.status).toBe("pending");
  });

  it("reject menyimpan alasan penolakan", async () => {
    const submit = await post(
      "/api/v1/event-contributions",
      eventBody({ name: " acara Ditolak E2E" }),
      userToken,
    );
    const row = (await submit.json()).data;

    const reject = await post(
      `/api/v1/admin/event-contributions/${row.id}/reject`,
      { reason_code: "duplicate", reason_text: "Sudah ada acara serupa." },
      adminToken,
    );
    expect(reject.status).toBe(200);

    const mine = await get("/api/v1/event-contributions/mine", userToken);
    const mineRow = (await mine.json()).data.items.find(
      (r: { id: string }) => r.id === row.id,
    );
    expect(mineRow?.status).toBe("rejected");
    expect(mineRow?.reject_reason_code).toBe("duplicate");
    expect(mineRow?.reject_reason_display).toContain("Sama dengan");
  });

  it("approve dua kali tidak bikin event dobel (idempoten)", async () => {
    const submit = await post(
      "/api/v1/event-contributions",
      eventBody({ name: "Acara Idempoten E2E" }),
      userToken,
    );
    const row = (await submit.json()).data;

    expect(
      (
        await post(
          `/api/v1/admin/event-contributions/${row.id}/approve`,
          {},
          adminToken,
        )
      ).status,
    ).toBe(200);
    const second = await post(
      `/api/v1/admin/event-contributions/${row.id}/approve`,
      {},
      adminToken,
    );
    expect(second.status).toBe(409);

    const list = await get("/api/v1/events?limit=100");
    const matches = (await list.json()).data.items.filter(
      (e: { name: string }) => e.name === "Acara Idempoten E2E",
    );
    expect(matches.length).toBe(1);
  });

  it("batalkan acara -> occurrence_status cancelled", async () => {
    const list = await get("/api/v1/admin/events?limit=100", adminToken);
    const target = (await list.json()).data.items.find(
      (e: { slug: string }) => e.slug === "pawai-blocks-e2e",
    );
    const res = await post(
      `/api/v1/admin/events/${target.id}/cancel`,
      { cancelled: true },
      adminToken,
    );
    expect(res.status).toBe(200);
    expect((await res.json()).data.occurrence_status).toBe("cancelled");
  });

  it("soft delete event -> hilang dari list publik", async () => {
    const list = await get("/api/v1/admin/events?limit=100", adminToken);
    const target = (await list.json()).data.items.find(
      (e: { slug: string }) => e.slug === "rahasia-draft-e2e",
    );
    const res = await del(`/api/v1/admin/events/${target.id}`, adminToken);
    expect(res.status).toBe(200);

    const detail = await get("/api/v1/events/rahasia-draft-e2e");
    expect(detail.status).toBe(404);
  });
});
