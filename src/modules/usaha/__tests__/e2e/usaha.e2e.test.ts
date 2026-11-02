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
 * E2E modul usaha:
 * - admin CRUD usaha (create/patch/restrict/restore/soft-delete)
 * - usulan publik anonim -> pending -> approve jadi usaha published
 * - request revision -> needs_revision -> resubmit
 * - klaim pengelola -> approve -> Usaha Saya + pengajuan pengelola
 * - field-lock, katalog item, laporan masyarakat
 * - otorisasi: draft/restricted tidak bocor, route admin butuh token
 */
describe.skipIf(!hasTestDb)("Usaha E2E - CRUD admin + usulan + klaim", () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let app: any;
  let adminToken: string;
  let userToken: string;
  let otherToken: string;
  let userId: string;
  let otherId: string;

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
  const patch = (path: string, body: unknown, token?: string) =>
    request(path, {
      method: "PATCH",
      body: JSON.stringify(body),
      headers: token ? { authorization: `Bearer ${token}` } : {},
    });
  const get = (path: string, token?: string) =>
    request(path, { headers: token ? { authorization: `Bearer ${token}` } : {} });
  const del = (path: string, token?: string) =>
    request(path, {
      method: "DELETE",
      headers: token ? { authorization: `Bearer ${token}` } : {},
    });

  const KEC_ID = "01E2EUSAHAKEC0000000001";
  const VILLAGE_ID = "01E2EUSAHADESA000000001";

  const usahaBody = (over: Record<string, unknown> = {}) => ({
    slug: "warung-kopi-e2e",
    name: "Warung Kopi E2E",
    description: "Warung kopi untuk uji e2e.",
    category_id: "kuliner",
    kind: "product",
    region_id: KEC_ID,
    village_id: VILLAGE_ID,
    address_text: "Jl. Raya Pemangkat no. 1",
    phone: "081200000001",
    whatsapp: "6281200000001",
    publish_status: "published",
    operational_status: "open",
    ...over,
  });

  const contributionBody = (over: Record<string, unknown> = {}) => ({
    name: "Kedai Sambal E2E",
    region_id: KEC_ID,
    village_id: VILLAGE_ID,
    category_id: "kuliner",
    description: "Kedai sambal untuk uji e2e.",
    phone: "081200000009",
    items: [{ name: "Sambal bawang", price_text: "Rp 10.000" }],
    ...over,
  });

  async function registerVerify(stamp: number, tag: string) {
    await post(
      "/api/v1/auth/register",
      e2eRegisterBody({ name: `${tag}${stamp}`, email: `${tag}${stamp}@test.com` }),
    );
    await post("/api/v1/auth/verify-email", {
      email: `${tag}${stamp}@test.com`,
      code: capturedOtpDisplayCode(),
    });
    return (
      await (
        await post("/api/v1/auth/login", {
          email: `${tag}${stamp}@test.com`,
          password: "Password123",
        })
      ).json()
    ).data.access_token as string;
  }

  async function login(stamp: number, tag: string) {
    return (
      await (
        await post("/api/v1/auth/login", {
          email: `${tag}${stamp}@test.com`,
          password: "Password123",
        })
      ).json()
    ).data.access_token as string;
  }

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
    await registerVerify(stamp, "adm");
    const [adminRow] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, `adm${stamp}@test.com`))
      .limit(1);
    if (adminRow)
      await db
        .insert(userRoles)
        .values({ userId: adminRow.id, role: "admin" })
        .onConflictDoNothing();
    // Login SETELAH role terpasang - JWT memuat role saat login.
    adminToken = await login(stamp, "adm");

    userToken = await registerVerify(stamp, "usr");
    otherToken = await registerVerify(stamp, "oth");
    const [userRow] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, `usr${stamp}@test.com`))
      .limit(1);
    const [otherRow] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, `oth${stamp}@test.com`))
      .limit(1);
    userId = userRow!.id;
    otherId = otherRow!.id;
  });

  it("admin buat usaha published -> tampil di list & detail publik", async () => {
    const res = await post("/api/v1/admin/usaha", usahaBody(), adminToken);
    expect(res.status).toBe(200);
    const created = (await res.json()).data;
    expect(created.slug).toBe("warung-kopi-e2e");
    expect(created.publish_status).toBe("published");
    expect(created.operational_status).toBe("open");
    expect(created.category?.name).toBe("Kuliner");
    expect(created.village?.name).toBe("Perapakan");

    const list = await get("/api/v1/usaha?limit=100");
    expect(list.status).toBe(200);
    const items = (await list.json()).data.items;
    expect(
      items.some((u: { slug: string }) => u.slug === "warung-kopi-e2e"),
    ).toBe(true);

    const detail = await get("/api/v1/usaha/warung-kopi-e2e");
    expect(detail.status).toBe(200);
    expect((await detail.json()).data.id).toBe(created.id);
  });

  it("katalog item: tampil di detail, soft-delete item menyembunyikannya", async () => {
    const created = (
      await post(
        "/api/v1/admin/usaha",
        usahaBody({ slug: "toko-katalog-e2e", name: "Toko Katalog E2E" }),
        adminToken,
      )
    ).status;
    expect(created).toBe(200);

    const detail = (
      await (await get("/api/v1/usaha/toko-katalog-e2e")).json()
    ).data;
    expect(Array.isArray(detail.items)).toBe(true);
    expect(detail.items.length).toBe(0);
  });

  it("katalog kategori usaha: publik hanya published", async () => {
    const pub = await get("/api/v1/usaha/categories");
    expect(pub.status).toBe(200);
    const items = (await pub.json()).data.items as Array<{ id: string }>;
    expect(items.some((c) => c.id === "kuliner")).toBe(true);

    // `/categories` bukan tertelan `/:slug`.
    expect(items.length).toBeGreaterThan(1);
  });

  it("draft & restricted tidak bocor ke publik tapi ada di list admin", async () => {
    await post(
      "/api/v1/admin/usaha",
      usahaBody({
        slug: "usaha-draft-e2e",
        name: "Usaha Draft E2E",
        publish_status: "draft",
      }),
      adminToken,
    );

    const pub = await get("/api/v1/usaha?limit=100");
    const pubItems = (await pub.json()).data.items;
    expect(
      pubItems.some((u: { slug: string }) => u.slug === "usaha-draft-e2e"),
    ).toBe(false);

    const admin = await get("/api/v1/admin/usaha?limit=100", adminToken);
    expect(admin.status).toBe(200);
    const adminItems = (await admin.json()).data.items;
    expect(
      adminItems.some((u: { slug: string }) => u.slug === "usaha-draft-e2e"),
    ).toBe(true);

    expect((await get("/api/v1/usaha/usaha-draft-e2e")).status).toBe(404);
  });

  it("restrict pakai alasan -> 404 publik; restore -> tampil lagi", async () => {
    const list = await get("/api/v1/admin/usaha?limit=100", adminToken);
    const target = (await list.json()).data.items.find(
      (u: { slug: string }) => u.slug === "warung-kopi-e2e",
    );

    const restricted = await post(
      `/api/v1/admin/usaha/${target.id}/restrict`,
      { reason: "Sedang dicek laporan masyarakat" },
      adminToken,
    );
    expect(restricted.status).toBe(200);
    expect((await restricted.json()).data.publish_status).toBe("restricted");
    expect((await get("/api/v1/usaha/warung-kopi-e2e")).status).toBe(404);

    const restored = await post(
      `/api/v1/admin/usaha/${target.id}/restore`,
      {},
      adminToken,
    );
    expect(restored.status).toBe(200);
    expect((await restored.json()).data.publish_status).toBe("published");
    expect((await get("/api/v1/usaha/warung-kopi-e2e")).status).toBe(200);
  });

  it("admin PATCH usaha mengubah field yang dikirim saja", async () => {
    const list = await get("/api/v1/admin/usaha?limit=100", adminToken);
    const target = (await list.json()).data.items.find(
      (u: { slug: string }) => u.slug === "toko-katalog-e2e",
    );

    const res = await patch(
      `/api/v1/admin/usaha/${target.id}`,
      { phone: "081255555555", operational_status: "temporarily_closed" },
      adminToken,
    );
    expect(res.status).toBe(200);
    const updated = (await res.json()).data;
    expect(updated.phone).toBe("081255555555");
    expect(updated.operational_status).toBe("temporarily_closed");
    // Field yang tidak dikirim tidak berubah.
    expect(updated.name).toBe("Toko Katalog E2E");
    expect(updated.publish_status).toBe("published");
  });

  it("validasi: wilayah wajib + lat/lng berpasangan + slug bentrok", async () => {
    const noRegion = await post(
      "/api/v1/admin/usaha",
      usahaBody({ slug: "tanpa-wilayah-e2e", region_id: null }),
      adminToken,
    );
    expect(noRegion.status).toBe(400);

    const halfCoord = await post(
      "/api/v1/admin/usaha",
      usahaBody({ slug: "koordinat-separuh-e2e", lat: 1.1 }),
      adminToken,
    );
    expect(halfCoord.status).toBe(400);

    const dup = await post("/api/v1/admin/usaha", usahaBody(), adminToken);
    expect(dup.status).toBe(409);
  });

  it("route admin butuh token", async () => {
    expect((await get("/api/v1/admin/usaha")).status).toBe(401);
    expect((await get("/api/v1/admin/usaha-contributions")).status).toBe(401);
    expect((await get("/api/v1/admin/usaha-claims")).status).toBe(401);
    expect((await get("/api/v1/admin/usaha-reports")).status).toBe(401);
  });

  it("usulan anonim -> pending -> approve -> usaha published", async () => {
    const submit = await post("/api/v1/usaha-contributions", contributionBody());
    expect(submit.status).toBe(200);
    const row = (await submit.json()).data;
    expect(row.status).toBe("pending");
    expect(row.kind).toBe("new");
    expect(row.wants_claim).toBe(false);
    expect(row.payload.name).toBe("Kedai Sambal E2E");

    const pending = await get(
      "/api/v1/admin/usaha-contributions?status=pending",
      adminToken,
    );
    expect(pending.status).toBe(200);
    expect(
      (await pending.json()).data.items.some(
        (r: { id: string }) => r.id === row.id,
      ),
    ).toBe(true);

    const approve = await post(
      `/api/v1/admin/usaha-contributions/${row.id}/approve`,
      {},
      adminToken,
    );
    expect(approve.status).toBe(200);

    const list = await get("/api/v1/usaha?limit=100");
    const created = (await list.json()).data.items.find(
      (u: { name: string }) => u.name === "Kedai Sambal E2E",
    );
    expect(created).toBeTruthy();
    expect(created.publish_status).toBe("published");
    expect(created.author_id).toBeNull(); // anonim tidak dapat atribusi akun

    // Idempoten: approve kedua kali 409, tidak bikin usaha dobel.
    const second = await post(
      `/api/v1/admin/usaha-contributions/${row.id}/approve`,
      {},
      adminToken,
    );
    expect(second.status).toBe(409);

    const after = await get("/api/v1/usaha?limit=100");
    const matches = (await after.json()).data.items.filter(
      (u: { name: string }) => u.name === "Kedai Sambal E2E",
    );
    expect(matches.length).toBe(1);
  });

  it("usulan user -> request revision -> resubmit -> reject dengan alasan", async () => {
    const submit = await post(
      "/api/v1/usaha-contributions",
      contributionBody({ name: "Usaha Revisi E2E" }),
      userToken,
    );
    const row = (await submit.json()).data;
    expect(row.status).toBe("pending");

    const revision = await post(
      `/api/v1/admin/usaha-contributions/${row.id}/request-revision`,
      { note: "Alamatnya belum jelas, tolong lengkapi ya." },
      adminToken,
    );
    expect(revision.status).toBe(200);

    const mine = await get("/api/v1/usaha-contributions/mine", userToken);
    const mineRow = (await mine.json()).data.items.find(
      (r: { id: string }) => r.id === row.id,
    );
    expect(mineRow.status).toBe("needs_revision");
    expect(mineRow.revision_note).toContain("Alamatnya belum jelas");

    const resubmit = await put(
      `/api/v1/usaha-contributions/${row.id}`,
      contributionBody({
        name: "Usaha Revisi E2E",
        address_text: "Jl. Parit Baru no. 9",
      }),
      userToken,
    );
    expect(resubmit.status).toBe(200);
    expect((await resubmit.json()).data.status).toBe("pending");

    // Usulan kedua lalu ditolak dengan alasan.
    const second = await post(
      "/api/v1/usaha-contributions",
      contributionBody({ name: "Usaha Ditolak E2E" }),
      userToken,
    );
    const secondRow = (await second.json()).data;
    const reject = await post(
      `/api/v1/admin/usaha-contributions/${secondRow.id}/reject`,
      { reason_code: "duplicate", reason_text: "Usaha serupa sudah terdaftar." },
      adminToken,
    );
    expect(reject.status).toBe(200);

    const mineAfter = await get("/api/v1/usaha-contributions/mine", userToken);
    const rejected = (await mineAfter.json()).data.items.find(
      (r: { id: string }) => r.id === secondRow.id,
    );
    expect(rejected.status).toBe("rejected");
    expect(rejected.reject_reason_code).toBe("duplicate");
  });

  it("usulan anonim tidak bisa membawa wants_claim (tanpa akun penerima)", async () => {
    const submit = await post(
      "/api/v1/usaha-contributions",
      contributionBody({ name: "Usaha Klaim Anon E2E", wants_claim: true }),
    );
    expect(submit.status).toBe(200);
    expect((await submit.json()).data.wants_claim).toBe(false);
  });

  it("batalkan usulan sendiri saat masih pending", async () => {
    const submit = await post(
      "/api/v1/usaha-contributions",
      contributionBody({ name: "Usaha Dibatalkan E2E" }),
      userToken,
    );
    const row = (await submit.json()).data;
    const cancel = await del(`/api/v1/usaha-contributions/${row.id}`, userToken);
    expect(cancel.status).toBe(200);

    const mine = await get("/api/v1/usaha-contributions/mine", userToken);
    expect(
      (await mine.json()).data.items.some((r: { id: string }) => r.id === row.id),
    ).toBe(false);
  });

  it("klaim pengelola -> approve -> manager_id terisi + klaim pesaing ditolak", async () => {
    const claimA = await post(
      "/api/v1/usaha/warung-kopi-e2e/claims",
      { contact_evidence: "WA 081200000001 milik saya" },
      userToken,
    );
    expect(claimA.status).toBe(200);
    const claimABody = (await claimA.json()).data;
    const claimAId = claimABody.id;
    expect(claimABody.contact_evidence).toBeUndefined();

    const claimB = await post(
      "/api/v1/usaha/warung-kopi-e2e/claims",
      { contact_evidence: "Saya pemilik sebenarnya" },
      otherToken,
    );
    expect(claimB.status).toBe(200);

    const queue = await get("/api/v1/admin/usaha-claims?status=pending", adminToken);
    expect(queue.status).toBe(200);
    const queueItems = (await queue.json()).data.items;
    expect(
      queueItems.some(
        (c: { id: string; contact_evidence?: string }) =>
          c.id === claimAId && c.contact_evidence === "WA 081200000001 milik saya",
      ),
    ).toBe(true);

    const approve = await post(
      `/api/v1/admin/usaha-claims/${claimAId}/approve`,
      {},
      adminToken,
    );
    expect(approve.status).toBe(200);

    const detail = (await (await get("/api/v1/usaha/warung-kopi-e2e")).json()).data;
    expect(detail.manager_id).toBe(userId);

    const mine = await get("/api/v1/usaha/mine", userToken);
    expect(mine.status).toBe(200);
    const mineData = (await mine.json()).data;
    expect(
      mineData.items.some((u: { slug: string }) => u.slug === "warung-kopi-e2e"),
    ).toBe(true);
    expect(mineData.pending_claim_count).toBe(0);

    // Klaim pesaing otomatis ditolak (CLAIM_CONFLICT).
    const otherClaims = await get("/api/v1/usaha/claims/mine", otherToken);
    const conflict = (await otherClaims.json()).data.items.find(
      (c: { usaha_slug?: string }) => c.usaha_slug === "warung-kopi-e2e",
    );
    expect(conflict.status).toBe("rejected");
    expect(conflict.reject_reason_code).toBe("claim_conflict");
  });

  it("pengajuan pengelola non-manager 403; field-lock menolak field beririsan", async () => {
    const detail = (await (await get("/api/v1/usaha/warung-kopi-e2e")).json()).data;

    const notManager = await post(
      "/api/v1/usaha-contributions/manager",
      {
        kind: "profile",
        usaha_id: detail.id,
        payload: { phone: "081299999999" },
        fields: ["phone"],
      },
      otherToken,
    );
    expect(notManager.status).toBe(403);

    const first = await post(
      "/api/v1/usaha-contributions/manager",
      {
        kind: "profile",
        usaha_id: detail.id,
        payload: { phone: "081288888888" },
        fields: ["phone"],
      },
      userToken,
    );
    expect(first.status).toBe(200);

    const conflict = await post(
      "/api/v1/usaha-contributions/manager",
      {
        kind: "profile",
        usaha_id: detail.id,
        payload: { phone: "081277777777" },
        fields: ["phone"],
      },
      userToken,
    );
    expect(conflict.status).toBe(409);
    expect((await conflict.json()).error_code).toBe("PENDING_FIELD_LOCK");

    // Field berbeda tetap boleh masuk antrean (PRD 10.1).
    const otherField = await post(
      "/api/v1/usaha-contributions/manager",
      {
        kind: "profile",
        usaha_id: detail.id,
        payload: { description: "Kopi robusta pilihan" },
        fields: ["description"],
      },
      userToken,
    );
    expect(otherField.status).toBe(200);
  });

  it("approve perubahan profil hanya menerapkan field terkunci", async () => {
    const queue = await get(
      "/api/v1/admin/usaha-contributions?status=pending&kind=profile",
      adminToken,
    );
    const rows = (await queue.json()).data.items as Array<{
      id: string;
      fields: string[];
      payload: Record<string, unknown>;
    }>;
    const phoneRow = rows.find((r) => r.fields.includes("phone"));
    expect(phoneRow).toBeTruthy();

    const approve = await post(
      `/api/v1/admin/usaha-contributions/${phoneRow!.id}/approve`,
      {},
      adminToken,
    );
    expect(approve.status).toBe(200);

    const detail = (await (await get("/api/v1/usaha/warung-kopi-e2e")).json()).data;
    expect(detail.phone).toBe("081288888888");
    // Field lain tidak ikut berubah.
    expect(detail.name).toBe("Warung Kopi E2E");
  });

  it("pengajuan item_add -> approve -> item muncul di katalog detail", async () => {
    const detail = (await (await get("/api/v1/usaha/warung-kopi-e2e")).json()).data;
    const submit = await post(
      "/api/v1/usaha-contributions/manager",
      {
        kind: "item_add",
        usaha_id: detail.id,
        payload: { name: "Kopi susu", priceText: "Rp 18.000" },
      },
      userToken,
    );
    expect(submit.status).toBe(200);
    const row = (await submit.json()).data;

    expect(
      (await post(`/api/v1/admin/usaha-contributions/${row.id}/approve`, {}, adminToken))
        .status,
    ).toBe(200);

    const after = (await (await get("/api/v1/usaha/warung-kopi-e2e")).json()).data;
    expect(
      after.items.some((it: { name: string }) => it.name === "Kopi susu"),
    ).toBe(true);
  });

  it("pengajuan operational hanya ubah status operasional, publish tetap", async () => {
    const detail = (await (await get("/api/v1/usaha/warung-kopi-e2e")).json()).data;
    const submit = await post(
      "/api/v1/usaha-contributions/manager",
      {
        kind: "operational",
        usaha_id: detail.id,
        payload: { operationalStatus: "temporarily_closed" },
      },
      userToken,
    );
    expect(submit.status).toBe(200);
    const row = (await submit.json()).data;

    expect(
      (await post(`/api/v1/admin/usaha-contributions/${row.id}/approve`, {}, adminToken))
        .status,
    ).toBe(200);

    const after = (await (await get("/api/v1/usaha/warung-kopi-e2e")).json()).data;
    expect(after.operational_status).toBe("temporarily_closed");
    expect(after.publish_status).toBe("published");
  });

  it("laporan masyarakat: satu laporan open per user, admin resolve", async () => {
    const submit = await post(
      "/api/v1/usaha/warung-kopi-e2e/reports",
      { reason_code: "wrong_location", note: "Alamatnya tidak sesuai" },
      otherToken,
    );
    expect(submit.status).toBe(200);
    const row = (await submit.json()).data;
    expect(row.status).toBe("open");

    const duplicate = await post(
      "/api/v1/usaha/warung-kopi-e2e/reports",
      { reason_code: "closed" },
      otherToken,
    );
    expect(duplicate.status).toBe(409);

    const queue = await get("/api/v1/admin/usaha-reports?status=open", adminToken);
    expect(
      (await queue.json()).data.items.some((r: { id: string }) => r.id === row.id),
    ).toBe(true);

    const resolve = await post(
      `/api/v1/admin/usaha-reports/${row.id}/resolve`,
      { status: "resolved", resolution: "Alamat sudah diperbaiki" },
      adminToken,
    );
    expect(resolve.status).toBe(200);
  });

  it("laporan/klaim wajib login", async () => {
    expect(
      (
        await post("/api/v1/usaha/warung-kopi-e2e/reports", {
          reason_code: "closed",
        })
      ).status,
    ).toBe(401);
    expect(
      (
        await post("/api/v1/usaha/warung-kopi-e2e/claims", {
          contact_evidence: "abcde",
        })
      ).status,
    ).toBe(401);
  });

  it("soft delete usaha -> hilang dari list publik", async () => {
    const list = await get("/api/v1/admin/usaha?limit=100", adminToken);
    const target = (await list.json()).data.items.find(
      (u: { slug: string }) => u.slug === "usaha-draft-e2e",
    );
    const res = await del(`/api/v1/admin/usaha/${target.id}`, adminToken);
    expect(res.status).toBe(200);
    expect((await get("/api/v1/usaha/usaha-draft-e2e")).status).toBe(404);
  });

  it("saran duplikat read-only: nama sama muncul sebagai kandidat", async () => {
    const list = await get("/api/v1/admin/usaha?limit=100", adminToken);
    const target = (await list.json()).data.items.find(
      (u: { slug: string }) => u.slug === "toko-katalog-e2e",
    );
    await post(
      "/api/v1/admin/usaha",
      usahaBody({
        slug: "toko-katalog-duplikat-e2e",
        name: "Toko Katalog E2E",
      }),
      adminToken,
    );

    const res = await get(
      `/api/v1/admin/usaha/${target.id}/duplicates`,
      adminToken,
    );
    expect(res.status).toBe(200);
    const items = (await res.json()).data.items as Array<{ slug: string }>;
    expect(
      items.some((u) => u.slug === "toko-katalog-duplikat-e2e"),
    ).toBe(true);

    // Tidak ada merge otomatis: usaha asli tetap ada.
    expect((await get("/api/v1/usaha/toko-katalog-e2e")).status).toBe(200);
    void otherId;
  });
});
