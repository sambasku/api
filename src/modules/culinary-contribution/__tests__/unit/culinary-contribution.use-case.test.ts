import { describe, it, expect, vi } from "vitest";
import { BadRequestError, ConflictError } from "@/shared/errors/app-error";
import {
  CulinaryContributionUseCases,
  canonicalCulinaryFields,
} from "../../application/culinary-contribution.use-cases";
import { UniqueCulinarySlugUseCase } from "@/modules/culinary/application/use-cases/culinary.use-cases";
import { ANONIM_USER_ID } from "@/shared/constants/anonim";

const NOW = new Date("2026-10-01T00:00:00Z");
const EARLIER = new Date("2026-09-01T00:00:00Z");

type Mock = Record<string, ReturnType<typeof vi.fn>>;

function makeContrib(over: Mock = {}) {
  return {
    create: vi.fn().mockResolvedValue({ id: "C1", status: "pending" }),
    findById: vi.fn().mockResolvedValue(null),
    listByUser: vi.fn().mockResolvedValue([]),
    list: vi.fn().mockResolvedValue([]),
    countPending: vi.fn().mockResolvedValue(0),
    pendingLockedFieldsForCuisine: vi.fn().mockResolvedValue([]),
    pendingLockedFieldsForUsaha: vi.fn().mockResolvedValue([]),
    setStatus: vi.fn(),
    replacePayload: vi.fn(),
    remove: vi.fn(),
    ...over,
  };
}

function makeCulinary(over: Mock = {}) {
  return {
    findCuisineById: vi.fn().mockResolvedValue({
      id: "K1",
      name: "Bubur Pedas",
      slug: "bubur-pedas",
      publishStatus: "published",
      createdAt: EARLIER,
      updatedAt: EARLIER,
      usahas: [],
    }),
    findCuisineBySlug: vi.fn().mockResolvedValue({ id: "K1", slug: "bubur-pedas" }),
    findLinkById: vi.fn().mockResolvedValue(null),
    findLinkByPair: vi.fn().mockResolvedValue(null),
    createCuisine: vi.fn().mockResolvedValue({ id: "K_NEW", name: "Pengkang" }),
    createLink: vi.fn(),
    updateCuisine: vi.fn(),
    updateLink: vi.fn(),
    categoryRef: vi.fn().mockResolvedValue({ id: "makanan-utama", name: "Makanan Utama" }),
    existingCuisineSlugs: vi.fn().mockResolvedValue(new Set<string>()),
    ...over,
  };
}
function makeUsahas(over: Mock = {}) {
  return {
    findById: vi.fn().mockResolvedValue({
      id: "U1",
      name: "Warung Bu Siti",
      slug: "warung-bu-siti",
      publishStatus: "published",
      createdAt: EARLIER,
      updatedAt: EARLIER,
    }),
    findBySlug: vi.fn().mockResolvedValue({ id: "U1", slug: "warung-bu-siti" }),
    create: vi.fn().mockResolvedValue({ id: "U_NEW", name: "Warung Baru" }),
    update: vi.fn(),
    existingSlugs: vi.fn().mockResolvedValue(new Set<string>()),
    ...over,
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function build(contrib: any, culinary: any, extra: any = {}, usahas: any = makeUsahas()) {
  return new CulinaryContributionUseCases(
    contrib,
    culinary,
    usahas,
    new UniqueCulinarySlugUseCase(culinary),
    extra.audit,
    extra.inbox,
    extra.notifyUser,
    extra.activityEvents,
  );
}

describe("Culinary contribution - submit usulan baru", () => {
  it("anonim boleh usul kuliner, tanpa batas pending", async () => {
    const contrib = makeContrib();
    const uc = build(contrib, makeCulinary());
    await uc.submit(ANONIM_USER_ID, { kind: "new_cuisine", payload: { name: "Pengkang" } });
    expect(contrib.countPending).not.toHaveBeenCalled();
    expect(contrib.create).toHaveBeenCalledOnce();
  });

  it("user login ditolak saat 10 usulan pending", async () => {
    const contrib = makeContrib({ countPending: vi.fn().mockResolvedValue(10) });
    const uc = build(contrib, makeCulinary());
    await expect(
      uc.submit("USER1", { kind: "new_cuisine", payload: { name: "Pengkang" } }),
    ).rejects.toBeInstanceOf(ConflictError);
  });

  it("gambar tanpa nama pemilik ditolak (rule PRD 13)", async () => {
    const uc = build(makeContrib(), makeCulinary());
    await expect(
      uc.submit(ANONIM_USER_ID, {
        kind: "new_cuisine",
        payload: {
          name: "Pengkang",
          images: [{ url: "https://x.test/a.jpg", attribution: { license: "CC BY-SA 4.0" } }],
        },
      }),
    ).rejects.toBeInstanceOf(BadRequestError);
  });

  it("lisensi kosong diisi CC BY-SA 4.0 otomatis (PRD kuliner)", async () => {
    const contrib = makeContrib();
    const uc = build(contrib, makeCulinary());
    await uc.submit(ANONIM_USER_ID, {
      kind: "new_cuisine",
      payload: {
        name: "Pengkang",
        images: [{ url: "https://x.test/a.jpg", attribution: { name: "Warga" } }],
      },
    });
    const arg = contrib.create.mock.calls[0][0] as {
      payload: { images: Array<{ attribution?: { license?: string } }> };
    };
    expect(arg.payload.images[0].attribution?.license).toBe("CC BY-SA 4.0");
  });

  it("approve dengan override images mengganti foto usulan", async () => {
    const culinary = makeCulinary();
    const row = {
      id: "C9",
      kind: "new_cuisine",
      status: "pending",
      userId: ANONIM_USER_ID,
      lockedFields: "",
      payload: {
        name: "Pengkang",
        images: [{ url: "https://x.test/a.jpg", attribution: { name: "Warga" } }],
      },
    };
    const contrib = makeContrib({ findById: vi.fn().mockResolvedValue(row) });
    const uc2 = build(contrib, culinary);
    await uc2.approve("C9", undefined, null, {
      images: [{ url: "https://x.test/b.jpg", attribution: { name: "Admin" } }],
    });
    expect(contrib.replacePayload).toHaveBeenCalled();
    const created = culinary.createCuisine.mock.calls[0][0] as {
      imagesJson: string | null;
    };
    expect(created.imagesJson).toContain("b.jpg");
    expect(created.imagesJson).toContain("Admin");
  });

  it("lat tanpa lng ditolak", async () => {
    const uc = build(makeContrib(), makeCulinary());
    await expect(
      uc.submit(ANONIM_USER_ID, {
        kind: "new_usaha",
        payload: { name: "Warung Baru", lat: 1.36 },
      }),
    ).rejects.toBeInstanceOf(BadRequestError);
  });
});

describe("Culinary contribution - field lock", () => {
  it("canonical field ter-sort dan unik", () => {
    expect(canonicalCulinaryFields(["tags", "name", "tags"])).toBe("name,tags");
  });

  it("overlap field pending -> 409 PENDING_FIELD_LOCK", async () => {
    const contrib = makeContrib({
      pendingLockedFieldsForCuisine: vi.fn().mockResolvedValue(["description,name"]),
    });
    const uc = build(contrib, makeCulinary());
    await expect(
      uc.submitChange("USER1", {
        kind: "cuisine_edit",
        cuisineId: "K1",
        payload: { name: "Bubur Pedas Baru" },
      }),
    ).rejects.toMatchObject({ errorCode: "PENDING_FIELD_LOCK" });
  });

  it("field berbeda tetap boleh diajukan", async () => {
    const contrib = makeContrib({
      pendingLockedFieldsForCuisine: vi.fn().mockResolvedValue(["description"]),
    });
    const uc = build(contrib, makeCulinary());
    await uc.submitChange("USER1", {
      kind: "cuisine_edit",
      cuisineId: "K1",
      payload: { tags: ["pedas"] },
    });
    expect(contrib.create).toHaveBeenCalledOnce();
  });

  it("field tak dikenal ditolak", async () => {
    const uc = build(makeContrib(), makeCulinary());
    await expect(
      uc.submitChange("USER1", {
        kind: "cuisine_edit",
        cuisineId: "K1",
        payload: { tags: ["pedas"] },
        fields: ["publishStatus"],
      }),
    ).rejects.toMatchObject({ errorCode: "UNKNOWN_FIELD" });
  });
});

describe("Culinary contribution - approve", () => {
  it("new_cuisine publish entitas + activity event + audit", async () => {
    const contrib = makeContrib({
      findById: vi.fn().mockResolvedValue({
        id: "C1",
        kind: "new_cuisine",
        userId: "USER1",
        cuisineId: null,
        usahaId: null,
        status: "pending",
        lockedFields: "",
        payload: { name: "Pengkang" },
      }),
    });
    const culinary = makeCulinary();
    const audit = { record: vi.fn() };
    const inbox = { execute: vi.fn() };
    const notifyUser = { execute: vi.fn() };
    const activityEvents = { append: vi.fn() };
    const uc = build(contrib, culinary, { audit, inbox, notifyUser, activityEvents });

    await uc.approve("C1", "ADMIN1", "REQ1");

    expect(culinary.createCuisine).toHaveBeenCalledOnce();
    expect(contrib.setStatus).toHaveBeenCalledWith(
      "C1",
      "approved",
      expect.objectContaining({ resultCuisineId: "K_NEW" }),
    );
    expect(activityEvents.append).toHaveBeenCalledWith(
      expect.objectContaining({ kind: "cuisine_published", targetId: "K_NEW" }),
    );
    expect(audit.record).toHaveBeenCalledOnce();
    expect(inbox.execute).toHaveBeenCalledWith(
      expect.objectContaining({ type: "culinary_contribution_approved" }),
    );
  });

  it("approve ganda ditolak (idempoten)", async () => {
    const contrib = makeContrib({
      findById: vi.fn().mockResolvedValue({
        id: "C1",
        kind: "new_cuisine",
        userId: "USER1",
        status: "approved",
        payload: { name: "Pengkang" },
        lockedFields: "",
      }),
    });
    const uc = build(contrib, makeCulinary());
    await expect(uc.approve("C1", "ADMIN1")).rejects.toMatchObject({
      errorCode: "NOT_PENDING",
    });
  });

  it("data target berubah sejak pengajuan -> STALE_DATA", async () => {
    const contrib = makeContrib({
      findById: vi.fn().mockResolvedValue({
        id: "C1",
        kind: "cuisine_edit",
        userId: "USER1",
        cuisineId: "K1",
        usahaId: null,
        status: "pending",
        lockedFields: "description",
        payload: { description: "Baru" },
        baseUpdatedAt: EARLIER,
      }),
    });
    const culinary = makeCulinary({
      findCuisineById: vi.fn().mockResolvedValue({
        id: "K1",
        name: "Bubur Pedas",
        createdAt: EARLIER,
        updatedAt: NOW, // lebih baru dari baseUpdatedAt
        usahas: [],
      }),
    });
    const uc = build(contrib, culinary);
    await expect(uc.approve("C1", "ADMIN1")).rejects.toMatchObject({
      errorCode: "STALE_DATA",
    });
    expect(culinary.updateCuisine).not.toHaveBeenCalled();
  });

  it("usaha_operational TIDAK mengubah publish_status", async () => {
    const contrib = makeContrib({
      findById: vi.fn().mockResolvedValue({
        id: "C1",
        kind: "usaha_operational",
        userId: "USER1",
        cuisineId: null,
        usahaId: "U1",
        status: "pending",
        lockedFields: "operationalStatus",
        payload: { operationalStatus: "temporarily_closed" },
        baseUpdatedAt: EARLIER,
      }),
    });
    const usahas = makeUsahas();
    const uc = build(contrib, makeCulinary(), {}, usahas);
    await uc.approve("C1", "ADMIN1");
    expect(usahas.update).toHaveBeenCalledWith({
      id: "U1",
      operationalStatus: "temporarily_closed",
    });
    expect(usahas.update).not.toHaveBeenCalledWith(
      expect.objectContaining({ publishStatus: expect.anything() }),
    );
  });
});

describe("Culinary contribution - submit / cancel life-cycle", () => {
  it("cancel hanya untuk usulan pending milik sendiri", async () => {
    const contrib = makeContrib({
      findById: vi.fn().mockResolvedValue({
        id: "C1",
        userId: "OTHER",
        status: "pending",
      }),
    });
    const uc = build(contrib, makeCulinary());
    await expect(uc.cancel("USER1", "C1")).rejects.toMatchObject({
      errorCode: "CONTRIBUTION_NOT_FOUND",
    });
  });

  it("resubmit hanya untuk status needs_revision", async () => {
    const contrib = makeContrib({
      findById: vi.fn().mockResolvedValue({
        id: "C1",
        kind: "new_cuisine",
        userId: "USER1",
        status: "pending",
        lockedFields: "",
      }),
    });
    const uc = build(contrib, makeCulinary());
    await expect(
      uc.resubmit("USER1", "C1", { kind: "new_cuisine", payload: { name: "Pengkang" } }),
    ).rejects.toMatchObject({ errorCode: "NOT_NEEDS_REVISION" });
  });
});
