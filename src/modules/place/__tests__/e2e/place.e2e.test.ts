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

describe.skipIf(!hasTestDb)("Place E2E - CRUD admin + list publik", () => {
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
  const patch = (path: string, body: unknown, token?: string) =>
    request(path, {
      method: "PATCH",
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

  beforeAll(async () => {
    const { getTestDb } = await import("@/shared/database/drizzle/test-client");
    const { languages, regions, userRoles, users, wordClasses } =
      await import("@/shared/database/drizzle/schema");
    const { truncateAll } =
      await import("@/shared/database/drizzle/test-utils");
    const db = getTestDb();
    await truncateAll(db);
    const ulid26 = (prefix: string) => prefix.padEnd(26, "0").slice(0, 26);
    await db.insert(languages).values([
      { id: ulid26("01E2ELANGSMB"), code: "smb", name: "Sambas" },
      { id: ulid26("01E2ELANGIDN"), code: "id", name: "Indonesia" },
    ]);
    await db.insert(wordClasses).values({
      id: ulid26("01E2EWCNOMINA"),
      code: "n",
      name: "Nomina",
    });

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

    await db.insert(regions).values([
      {
        id: "01E2EREGIONKEC0000000001",
        slug: "pemangkat",
        name: "Pemangkat",
        type: "kecamatan",
        status: "published",
      },
      {
        id: "01E2EREGIONDESA000000001",
        slug: "pemangkat/perapakan",
        name: "Perapakan",
        type: "desa",
        parentId: "01E2EREGIONKEC0000000001",
        status: "published",
      },
    ]);

    await post(
      "/api/v1/auth/register",
      e2eRegisterBody({ name: `usr${stamp}`, email: `usr${stamp}@test.com` }),
    );
    await post("/api/v1/auth/verify-email", {
      email: `usr${stamp}@test.com`,
      code: capturedOtpDisplayCode(),
    });
    userToken = (
      await (
        await post("/api/v1/auth/login", {
          email: `usr${stamp}@test.com`,
          password: "Password123",
        })
      ).json()
    ).data.access_token;
  });

  it("admin create → publik list/detail → soft delete hilang dari publik", async () => {
    const createRes = await post(
      "/api/v1/admin/places",
      {
        slug: "pantai-test-e2e",
        name: "Pantai Test E2E",
        category: "wisata",
        type: "pantai",
        lat: 1.35,
        lng: 109.2,
        short_description: "Deskripsi singkat untuk uji e2e.",
        region_id: "pemangkat",
        village_id: "pemangkat/perapakan",
        images: [
          {
            url: "https://cdn.jsdelivr.net/gh/sambasku/images@main/assets/places/test.webp",
            is_main: true,
            attribution: {
              name: "Tester",
              provider: "sambasku",
              authorId: "iamutaki",
            },
          },
        ],
        sources: [
          {
            name: "Sumber uji",
            type: "web",
            address: "https://example.com/sumber",
          },
        ],
      },
      adminToken,
    );
    expect(createRes.status).toBe(200);
    const created = (await createRes.json()).data;
    expect(created.slug).toBe("pantai-test-e2e");
    expect(created.images).toHaveLength(1);
    expect(created.images[0].is_main).toBe(true);
    expect(created.village_id).toBe("pemangkat/perapakan");

    const listRes = await get("/api/v1/places?category=wisata");
    expect(listRes.status).toBe(200);
    const listBody = (await listRes.json()).data;
    expect(
      listBody.items.some(
        (p: { slug: string }) => p.slug === "pantai-test-e2e",
      ),
    ).toBe(true);
    expect(
      listBody.next_cursor === null || typeof listBody.next_cursor === "string",
    ).toBe(true);

    const typedRes = await get(
      "/api/v1/places?category=wisata&type=pantai&limit=50",
    );
    expect(typedRes.status).toBe(200);
    const typed = (await typedRes.json()).data.items;
    expect(
      typed.some((p: { slug: string }) => p.slug === "pantai-test-e2e"),
    ).toBe(true);

    const otherType = await get(
      "/api/v1/places?category=wisata&type=sejarah&limit=50",
    );
    expect(otherType.status).toBe(200);
    const sejarah = (await otherType.json()).data.items;
    expect(
      sejarah.some((p: { slug: string }) => p.slug === "pantai-test-e2e"),
    ).toBe(false);

    const detailRes = await get("/api/v1/places/pantai-test-e2e");
    expect(detailRes.status).toBe(200);
    expect((await detailRes.json()).data.name).toBe("Pantai Test E2E");

    const patchRes = await patch(
      `/api/v1/admin/places/${created.id}`,
      { name: "Pantai Test E2E Updated" },
      adminToken,
    );
    expect(patchRes.status).toBe(200);
    expect((await patchRes.json()).data.name).toBe("Pantai Test E2E Updated");

    const delRes = await del(`/api/v1/admin/places/${created.id}`, adminToken);
    expect(delRes.status).toBe(200);

    const gone = await get("/api/v1/places/pantai-test-e2e");
    expect(gone.status).toBe(404);
  });

  it("slug bentrok → 409 SLUG_TAKEN", async () => {
    const body = {
      slug: "slug-dup-e2e",
      name: "A",
      category: "budaya",
      short_description: "x",
    };
    expect((await post("/api/v1/admin/places", body, adminToken)).status).toBe(
      200,
    );
    const dup = await post("/api/v1/admin/places", body, adminToken);
    expect(dup.status).toBe(409);
    expect((await dup.json()).error_code).toBe("SLUG_TAKEN");
  });

  it("usulan menunggu tinjauan, foto langsung nempel, related tidak terhapus", async () => {
    const photo =
      "https://cdn.jsdelivr.net/gh/sambasku/images@main/assets/places/usulan.webp";
    const extra =
      "https://cdn.jsdelivr.net/gh/sambasku/images@main/assets/places/tambahan.webp";
    const submit = await post(
      "/api/v1/place-contributions",
      {
        slug: "pantai-usulan-e2e",
        name: "Pantai Usulan",
        category: "wisata",
        type: "pantai",
        lat: 1.36,
        lng: 109.3,
        short_description: "Usulan dari user.",
        region_id: "01E2EREGIONKEC0000000001",
        village_id: "01E2EREGIONDESA000000001",
        images: [{ url: photo, is_main: true }],
      },
      userToken,
    );
    expect(submit.status).toBe(200);
    const proposalId = (await submit.json()).data.id as string;

    const hidden = await get("/api/v1/places/pantai-usulan-e2e");
    expect(hidden.status).toBe(404);

    const approve = await post(
      `/api/v1/admin/place-contributions/${proposalId}/approve`,
      {},
      adminToken,
    );
    expect(approve.status).toBe(200);

    // Notifikasi inbox sampai ke pengusul non-anonim setelah approve.
    const notifRes = await get("/api/v1/notifications?limit=20", userToken);
    expect(notifRes.status).toBe(200);
    const notifItems = (await notifRes.json()).data as Array<
      Record<string, unknown>
    >;
    expect(
      notifItems.find(
        (n) =>
          n.type === "place_contribution_approved" &&
          n.target_id === proposalId,
      ),
    ).toMatchObject({
      target_kind: "place_contribution",
      title: expect.stringContaining("disetujui"),
      action_kind: "place_contribution",
    });

    const detail = await get("/api/v1/places/pantai-usulan-e2e");
    expect(detail.status).toBe(200);
    const place = (await detail.json()).data;
    expect(place.images[0].is_main).toBe(true);
    expect(place.images[0].attribution.provider).toBe("sambasku");
    expect(place.image_count).toBe(1);

    const live = await post(
      `/api/v1/places/pantai-usulan-e2e/images`,
      { urls: [extra] },
      userToken,
    );
    expect(live.status).toBe(200);

    // #187: foto wisata = aksi publik -> event feed tertulis (AGENTS.md #25).
    const { activityEvents } = await import(
      "@/shared/database/drizzle/schema"
    );
    const { getTestDb: getDb } = await import(
      "@/shared/database/drizzle/test-client"
    );
    const events = await getDb()
      .select()
      .from(activityEvents)
      .where(eq(activityEvents.kind, "place_photo_added"));
    expect(events).toHaveLength(1);
    expect(events[0].targetId).toBe(place.id);
    expect(events[0].dedupeKey).toBe(`place_photo:${place.id}:${extra}`);
    expect(events[0].payload).toBe("Menambahkan foto wisata Pantai Usulan");

    // Feed publik menampilkan event foto wisata.
    const feed = await get("/api/v1/activity");
    expect(feed.status).toBe(200);
    const feedItems = (await feed.json()).data as Array<{
      kind: string;
      target: { type: string; id: string } | null;
      subtitle: string | null;
    }>;
    const photoItem = feedItems.find((i) => i.kind === "place_photo");
    expect(photoItem).toMatchObject({
      target: { type: "place", id: "pantai-usulan-e2e" },
      subtitle: "Pantai Usulan",
    });

    const afterPhoto = (
      await (await get("/api/v1/places/pantai-usulan-e2e")).json()
    ).data;
    expect(afterPhoto.image_count).toBe(2);
    expect(
      afterPhoto.images.find((img: { url: string }) => img.url === extra)
        .is_main,
    ).toBe(false);

    const neighbor = await post(
      "/api/v1/admin/places",
      {
        slug: "tetangga-usulan-e2e",
        name: "Tetangga",
        category: "wisata",
        short_description: "Dekat.",
        related: [{ kind: "place", slug: "pantai-usulan-e2e" }],
      },
      adminToken,
    );
    expect(neighbor.status).toBe(200);
    const neighborBody = (await neighbor.json()).data;
    await patch(
      `/api/v1/admin/places/${place.id}`,
      {
        related: [
          { kind: "place", slug: "tetangga-usulan-e2e" },
          { kind: "usaha", slug: "warung-kopi" },
        ],
      },
      adminToken,
    );

    const edit = await post(
      "/api/v1/place-contributions",
      {
        place_id: place.id,
        slug: "pantai-usulan-e2e",
        name: "Pantai Usulan Baru",
        category: "wisata",
        type: "pantai",
        lat: 1.36,
        lng: 109.3,
        short_description: "Suntingan.",
        region_id: "01E2EREGIONKEC0000000001",
        village_id: "01E2EREGIONDESA000000001",
        images: [{ url: extra }],
      },
      userToken,
    );
    expect(edit.status).toBe(200);
    const editId = (await edit.json()).data.id as string;
    expect(
      (
        await post(
          `/api/v1/admin/place-contributions/${editId}/approve`,
          {},
          adminToken,
        )
      ).status,
    ).toBe(200);

    const finalRes = await get("/api/v1/places/pantai-usulan-e2e");
    const finalPlace = (await finalRes.json()).data;
    expect(finalPlace.name).toBe("Pantai Usulan Baru");
    expect(finalPlace.image_count).toBe(2);
    expect(finalPlace.images[0].is_main).toBe(true);
    expect(finalPlace.related.map((r: { slug: string }) => r.slug)).toEqual([
      "tetangga-usulan-e2e",
      "warung-kopi",
    ]);
    expect(finalPlace.related[0].name).toBe("Tetangga");
    expect(finalPlace.related[1].name).toBeNull();
    expect(neighborBody.slug).toBe("tetangga-usulan-e2e");
  });

  it("reject usulan wajib beralasan: disimpan, tampil ke pengusul, masuk notifikasi", async () => {
    const submit = await post(
      "/api/v1/place-contributions",
      {
        slug: "usulan-ditolak-e2e",
        name: "Usulan Ditolak",
        category: "wisata",
        short_description: "Usulan yang ditolak.",
      },
      userToken,
    );
    expect(submit.status).toBe(200);
    const id = (await submit.json()).data.id as string;

    // Tanpa alasan → 400.
    expect(
      (
        await post(
          `/api/v1/admin/place-contributions/${id}/reject`,
          {},
          adminToken,
        )
      ).status,
    ).toBe(400);
    // other tanpa catatan → 400.
    expect(
      (
        await post(
          `/api/v1/admin/place-contributions/${id}/reject`,
          { reason_code: "other" },
          adminToken,
        )
      ).status,
    ).toBe(400);

    const ok = await post(
      `/api/v1/admin/place-contributions/${id}/reject`,
      {
        reason_code: "inaccurate",
        reason_text: "Koordinat meleset dari desa.",
      },
      adminToken,
    );
    expect(ok.status).toBe(200);

    const mine = await get("/api/v1/place-contributions/mine", userToken);
    const row = (
      (await mine.json()).data.items as Array<Record<string, unknown>>
    ).find((r) => r.id === id);
    expect(row).toMatchObject({
      status: "rejected",
      reject_reason_code: "inaccurate",
      reject_reason_display:
        "Data atau lokasi tidak akurat: Koordinat meleset dari desa.",
    });

    const notif = await get("/api/v1/notifications?limit=20", userToken);
    const items = (await notif.json()).data as Array<Record<string, unknown>>;
    const rejectNotif = items.find(
      (n) => n.type === "place_contribution_rejected" && n.target_id === id,
    );
    expect(rejectNotif?.body).toContain(
      "Alasan: Data atau lokasi tidak akurat: Koordinat meleset dari desa.",
    );
  });

  it("self-review tanpa notifikasi: admin approve usulan sendiri", async () => {
    const submit = await post(
      "/api/v1/place-contributions",
      {
        slug: "usulan-admin-sendiri-e2e",
        name: "Usulan Admin Sendiri",
        category: "wisata",
        short_description: "Diusulkan admin, direview admin.",
      },
      adminToken,
    );
    expect(submit.status).toBe(200);
    const id = (await submit.json()).data.id as string;
    expect(
      (
        await post(
          `/api/v1/admin/place-contributions/${id}/approve`,
          {},
          adminToken,
        )
      ).status,
    ).toBe(200);
    const notif = await get("/api/v1/notifications?limit=20", adminToken);
    const items = (await notif.json()).data as Array<Record<string, unknown>>;
    expect(
      items.find(
        (n) => n.type === "place_contribution_approved" && n.target_id === id,
      ),
    ).toBeUndefined();
  });

  it("rate limit anonim: submit ke-6 tanpa token = 429, token tetap lolos", async () => {
    // Submit anonim 5x pertama lolos, ke-6 kena tier 5/jam/IP.
    for (let i = 0; i < 5; i++) {
      const res = await post("/api/v1/place-contributions", {
        slug: `anon-rate-e2e-${i}`,
        name: `Usulan Anonim ${i}`,
        category: "wisata",
        short_description: "Rate limit probe.",
      });
      expect(res.status).toBe(200);
    }
    const sixth = await post("/api/v1/place-contributions", {
      slug: "anon-rate-e2e-5",
      name: "Usulan Anonim 5",
      category: "wisata",
      short_description: "Rate limit probe.",
    });
    expect(sixth.status).toBe(429);
    expect((await sixth.json()).error_code).toBe("RATE_LIMITED");
    // Request terautentikasi tidak ikut kena bucket anonim.
    const authed = await post(
      "/api/v1/place-contributions",
      {
        slug: "anon-rate-e2e-authed",
        name: "Usulan Ber token",
        category: "wisata",
        short_description: "Rate limit probe.",
      },
      userToken,
    );
    expect(authed.status).toBe(200);
  });
  it("#187: anonim dilarang unggah foto, tamu terautentikasi boleh", async () => {
    const place = "pantai-usulan-e2e";
    const anonymous = await post(`/api/v1/places/${place}/images`, {
      urls: [
        "https://cdn.jsdelivr.net/gh/sambasku/images@main/assets/places/anon.webp",
      ],
    });
    expect(anonymous.status).toBe(401);
    expect((await anonymous.json()).error_code).toBe("UNAUTHORIZED");
  });

  it("#187: takedown foto menyembunyikan foto + event feed-nya", async () => {
    const place = "pantai-usulan-e2e";
    const extra =
      "https://cdn.jsdelivr.net/gh/sambasku/images@main/assets/places/takedown.webp";
    expect(
      (await post(`/api/v1/places/${place}/images`, { urls: [extra] }, userToken))
        .status,
    ).toBe(200);
    const before = (await (await get(`/api/v1/places/${place}`)).json()).data;
    const target = (
      before.images as Array<{ id: string; url: string }>
    ).find((img) => img.url === extra);
    expect(target).toBeTruthy();

    // Takedown admin: foto hilang dari galeri publik.
    expect(
      (await del(`/api/v1/admin/places/${before.id}/images/${target!.id}`, adminToken))
        .status,
    ).toBe(200);
    const after = (await (await get(`/api/v1/places/${place}`)).json()).data;
    expect(
      (after.images as Array<{ url: string }>).some((img) => img.url === extra),
    ).toBe(false);
    expect(after.image_count).toBe(before.image_count - 1);

    // Event batch yang memuat URL itu tersembunyi; batch lain tetap tayang.
    const { activityEvents } = await import(
      "@/shared/database/drizzle/schema"
    );
    const { getTestDb: getDb } = await import(
      "@/shared/database/drizzle/test-client"
    );
    const events = await getDb()
      .select()
      .from(activityEvents)
      .where(eq(activityEvents.kind, "place_photo_added"));
    const hidden = events.find((e) => e.dedupeKey?.includes(extra));
    expect(hidden?.hiddenAt).not.toBeNull();
    expect(events.filter((e) => e.hiddenAt === null).length).toBe(
      events.length - 1,
    );
  });

  it("#187: takedown foto tak dikenal = 404", async () => {
    const detail = (
      await (await get("/api/v1/places/pantai-usulan-e2e")).json()
    ).data;
    const res = await del(
      `/api/v1/admin/places/${detail.id}/images/01NOTAREALIMAGE0000000000`,
      adminToken,
    );
    expect(res.status).toBe(404);
    expect((await res.json()).error_code).toBe("IMAGE_NOT_FOUND");
  });
});
