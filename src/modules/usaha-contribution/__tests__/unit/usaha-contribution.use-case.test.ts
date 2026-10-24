import { describe, it, expect, vi } from "vitest";
import {
  BadRequestError,
  ConflictError,
  ForbiddenError,
} from "@/shared/errors/app-error";
import { UsahaContributionUseCases } from "../../application/usaha-contribution.use-cases";
import { UniqueUsahaSlugUseCase } from "@/modules/usaha/application/use-cases/usaha.use-cases";
import { ANONIM_USER_ID } from "@/shared/constants/anonim";

const NOW = new Date("2026-10-01T00:00:00Z");

type Mock = Record<string, ReturnType<typeof vi.fn>>;

function makeContrib(over: Mock = {}) {
  return {
    create: vi.fn().mockResolvedValue({ id: "C1", status: "pending" }),
    findById: vi.fn().mockResolvedValue(null),
    listByUser: vi.fn().mockResolvedValue([]),
    list: vi.fn().mockResolvedValue([]),
    countPending: vi.fn().mockResolvedValue(0),
    pendingLockedFields: vi.fn().mockResolvedValue([]),
    pendingCountsByUsaha: vi.fn().mockResolvedValue(new Map()),
    setStatus: vi.fn(),
    replacePayload: vi.fn(),
    remove: vi.fn(),
    ...over,
  };
}

function makeUsaha(over: Mock = {}) {
  return {
    findById: vi.fn().mockResolvedValue({
      id: "U1",
      name: "Warung Kopi",
      slug: "warung-kopi",
      managerId: "USER1",
      publishStatus: "published",
      updatedAt: NOW,
      createdAt: NOW,
      phone: "0812",
      items: [{ id: "ITEM1", name: "Kopi" }],
    }),
    findBySlug: vi.fn().mockResolvedValue({ id: "U1" }),
    create: vi.fn().mockResolvedValue({ id: "U1" }),
    update: vi.fn().mockResolvedValue({ id: "U1" }),
    insertItem: vi.fn().mockResolvedValue("ITEM_NEW"),
    updateItem: vi.fn().mockResolvedValue(true),
    softDeleteItem: vi.fn().mockResolvedValue(true),
    categoryRef: vi.fn().mockResolvedValue({ id: "kuliner", name: "Kuliner" }),
    existingSlugs: vi.fn().mockResolvedValue(new Set<string>()),
    ...over,
  };
}

const regions = {
  findById: vi.fn(async (id: string) =>
    id === "VILLAGE_BAD"
      ? { id, type: "desa", status: "published", parentId: "OTHER_KEC" }
      : id === "KEC1"
        ? { id, type: "kecamatan", status: "published" }
        : { id, type: "desa", status: "published", parentId: "KEC1" },
  ),
};

/** eslint-disable-next-line @typescript-eslint/no-explicit-any */
function build(contrib: any, usaha: any, claims: any = {}, createUc?: any) {
  const create = createUc ?? {
    execute: vi.fn().mockResolvedValue({ id: "U_NEW", slug: "usaha-baru", name: "Usaha Baru" }),
  };
  const uc = new UsahaContributionUseCases(
    contrib,
    usaha,
    regions as never,
    create as never,
    new UniqueUsahaSlugUseCase(usaha),
    {
      create: vi.fn().mockResolvedValue({ id: "CLAIM1" }),
      findPendingByUser: vi.fn().mockResolvedValue(null),
      ...claims,
    } as never,
  );
  return Object.assign(uc, { __createUc: create }) as UsahaContributionUseCases & {
    __createUc: { execute: ReturnType<typeof vi.fn> };
  };
}

const newPayload = {
  name: "Usaha Baru",
  regionId: "KEC1",
  items: [{ name: "Item" }],
};

describe("UsahaContributionUseCases - usulan baru", () => {
  it("anonim tidak boleh membawa wants_claim", async () => {
    const contrib = makeContrib();
    const uc = build(contrib, makeUsaha());
    await uc.submit(ANONIM_USER_ID, { payload: newPayload, wantsClaim: true });
    expect(contrib.create).toHaveBeenCalledWith(
      expect.objectContaining({ wantsClaim: false, kind: "new" }),
    );
  });

  it("user login boleh menandai wants_claim", async () => {
    const contrib = makeContrib();
    const uc = build(contrib, makeUsaha());
    await uc.submit("USER1", { payload: newPayload, wantsClaim: true });
    expect(contrib.create).toHaveBeenCalledWith(
      expect.objectContaining({ wantsClaim: true }),
    );
  });

  it("tolak nama < 3 karakter", async () => {
    const uc = build(makeContrib(), makeUsaha());
    await expect(
      uc.submit("USER1", { payload: { ...newPayload, name: "ab" }, wantsClaim: false }),
    ).rejects.toBeInstanceOf(BadRequestError);
  });

  it("tolak desa yang bukan bagian kecamatan", async () => {
    const uc = build(makeContrib(), makeUsaha());
    await expect(
      uc.submit("USER1", {
        payload: { ...newPayload, villageId: "VILLAGE_BAD" },
        wantsClaim: false,
      }),
    ).rejects.toBeInstanceOf(BadRequestError);
  });

  it("tolak lat tanpa lng", async () => {
    const uc = build(makeContrib(), makeUsaha());
    await expect(
      uc.submit("USER1", {
        payload: { ...newPayload, lat: 1.1 },
        wantsClaim: false,
      }),
    ).rejects.toBeInstanceOf(BadRequestError);
  });

  it("PENDING_CAP: 10 usulan pending sudah mentok", async () => {
    const contrib = makeContrib({ countPending: vi.fn().mockResolvedValue(10) });
    const uc = build(contrib, makeUsaha());
    await expect(
      uc.submit("USER1", { payload: newPayload, wantsClaim: false }),
    ).rejects.toBeInstanceOf(ConflictError);
  });
});

describe("UsahaContributionUseCases - pengajuan pengelola", () => {
  const base = {
    kind: "profile" as const,
    usahaId: "U1",
    payload: { phone: "0812999" },
    fields: ["phone"],
  };

  it("non-manager 403", async () => {
    const uc = build(makeContrib(), makeUsaha());
    await expect(
      uc.submitManagerChange("USER2", base),
    ).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("usaha restricted tidak boleh diajukan", async () => {
    const usaha = makeUsaha({
      findById: vi.fn().mockResolvedValue({
        id: "U1",
        managerId: "USER1",
        publishStatus: "restricted",
        updatedAt: NOW,
        createdAt: NOW,
        items: [],
      }),
    });
    const uc = build(makeContrib(), usaha);
    await expect(
      uc.submitManagerChange("USER1", base),
    ).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("field-lock: field beririsan ditolak PENDING_FIELD_LOCK", async () => {
    const contrib = makeContrib({
      pendingLockedFields: vi.fn().mockResolvedValue(["phone"]),
    });
    const uc = build(contrib, makeUsaha());
    await expect(uc.submitManagerChange("USER1", base)).rejects.toMatchObject({
      errorCode: "PENDING_FIELD_LOCK",
    });
  });

  it("field berbeda tetap boleh (partial overlap tidak memblokir)", async () => {
    const contrib = makeContrib({
      pendingLockedFields: vi.fn().mockResolvedValue(["description"]),
    });
    const uc = build(contrib, makeUsaha());
    await uc.submitManagerChange("USER1", base);
    expect(contrib.create).toHaveBeenCalledWith(
      expect.objectContaining({ lockedFields: "phone" }),
    );
  });

  it("field tak dikenal ditolak", async () => {
    const uc = build(makeContrib(), makeUsaha());
    await expect(
      uc.submitManagerChange("USER1", {
        ...base,
        payload: { publishStatus: "published" } as never,
        fields: ["publishStatus"],
      }),
    ).rejects.toMatchObject({ errorCode: "UNKNOWN_FIELD" });
  });

  it("locked_fields kanonik ter-sort", async () => {
    const contrib = makeContrib();
    const uc = build(contrib, makeUsaha());
    await uc.submitManagerChange("USER1", {
      kind: "profile",
      usahaId: "U1",
      payload: { phone: "0812", description: "baru" },
      fields: ["phone", "description"],
    });
    expect(contrib.create).toHaveBeenCalledWith(
      expect.objectContaining({ lockedFields: "description,phone" }),
    );
  });

  it("item_edit pada item usaha lain 403", async () => {
    const uc = build(makeContrib(), makeUsaha());
    await expect(
      uc.submitManagerChange("USER1", {
        kind: "item_edit",
        usahaId: "U1",
        itemId: "ITEM_LAIN",
        payload: { name: "Baru" },
      }),
    ).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("operational tanpa status ditolak", async () => {
    const uc = build(makeContrib(), makeUsaha());
    await expect(
      uc.submitManagerChange("USER1", {
        kind: "operational",
        usahaId: "U1",
        payload: {},
      }),
    ).rejects.toBeInstanceOf(BadRequestError);
  });
});

describe("UsahaContributionUseCases - approve per kind", () => {
  function pendingRow(over: Record<string, unknown> = {}) {
    return {
      id: "C1",
      kind: "profile",
      userId: "USER1",
      usahaId: "U1",
      itemId: null,
      lockedFields: "phone",
      payload: { phone: "0812999" },
      status: "pending",
      wantsClaim: false,
      baseUpdatedAt: NOW,
      createdAt: NOW,
      ...over,
    };
  }

  it("kind=new membuat usaha published + item", async () => {
    const usaha = makeUsaha();
    const contrib = makeContrib({
      findById: vi.fn().mockResolvedValue(
        pendingRow({ kind: "new", usahaId: null, lockedFields: "", payload: newPayload }),
      ),
    });
    const uc = build(contrib, usaha);
    await uc.approve("C1", "ADMIN");
    expect(uc.__createUc.execute).toHaveBeenCalledWith(
      expect.objectContaining({ publishStatus: "published", name: "Usaha Baru" }),
    );
    expect(contrib.setStatus).toHaveBeenCalledWith("C1", "approved", {
      resultUsahaId: "U_NEW",
    });
  });

  it("kind=new + wants_claim membuat klaim pending", async () => {
    const claims = {
      create: vi.fn().mockResolvedValue({ id: "CLAIM1" }),
      findPendingByUser: vi.fn().mockResolvedValue(null),
    };
    const contrib = makeContrib({
      findById: vi.fn().mockResolvedValue(
        pendingRow({
          kind: "new",
          usahaId: null,
          lockedFields: "",
          payload: newPayload,
          wantsClaim: true,
        }),
      ),
    });
    const uc = build(contrib, makeUsaha(), claims);
    await uc.approve("C1", "ADMIN");
    expect(claims.create).toHaveBeenCalledWith(
      expect.objectContaining({ usahaId: "U_NEW", userId: "USER1" }),
    );
  });

  it("kind=new anonim tidak membuat klaim", async () => {
    const claims = { create: vi.fn(), findPendingByUser: vi.fn() };
    const contrib = makeContrib({
      findById: vi.fn().mockResolvedValue(
        pendingRow({
          kind: "new",
          usahaId: null,
          lockedFields: "",
          payload: newPayload,
          wantsClaim: true,
          userId: ANONIM_USER_ID,
        }),
      ),
    });
    const uc = build(contrib, makeUsaha(), claims);
    await uc.approve("C1", "ADMIN");
    expect(claims.create).not.toHaveBeenCalled();
  });

  it("profile hanya menerapkan field terkunci", async () => {
    const usaha = makeUsaha();
    const uc = build(makeContrib({ findById: vi.fn().mockResolvedValue(pendingRow()) }), usaha);
    await uc.approve("C1", "ADMIN");
    expect(usaha.update).toHaveBeenCalledWith({ id: "U1", phone: "0812999" });
  });

  it("operational tidak mengubah publish_status", async () => {
    const usaha = makeUsaha();
    const row = pendingRow({
      kind: "operational",
      lockedFields: "operationalStatus",
      payload: { operationalStatus: "temporarily_closed" },
    });
    const uc = build(makeContrib({ findById: vi.fn().mockResolvedValue(row) }), usaha);
    await uc.approve("C1", "ADMIN");
    expect(usaha.update).toHaveBeenCalledWith({
      id: "U1",
      operationalStatus: "temporarily_closed",
    });
  });

  it("archive & restore hanya ubah publish_status", async () => {
    const usaha = makeUsaha();
    const archiveRow = pendingRow({ kind: "archive", lockedFields: "publishStatus", payload: {} });
    const uc = build(makeContrib({ findById: vi.fn().mockResolvedValue(archiveRow) }), usaha);
    await uc.approve("C1", "ADMIN");
    expect(usaha.update).toHaveBeenCalledWith({ id: "U1", publishStatus: "archived" });

    const restoreRow = pendingRow({ kind: "restore", lockedFields: "publishStatus", payload: {} });
    const uc2 = build(makeContrib({ findById: vi.fn().mockResolvedValue(restoreRow) }), usaha);
    await uc2.approve("C1", "ADMIN");
    expect(usaha.update).toHaveBeenLastCalledWith({
      id: "U1",
      publishStatus: "published",
    });
  });

  it("item_delete soft-delete item", async () => {
    const usaha = makeUsaha();
    const row = pendingRow({ kind: "item_delete", itemId: "ITEM1", lockedFields: "item:ITEM1", payload: {} });
    const uc = build(makeContrib({ findById: vi.fn().mockResolvedValue(row) }), usaha);
    await uc.approve("C1", "ADMIN");
    expect(usaha.softDeleteItem).toHaveBeenCalledWith("ITEM1");
  });

  it("STALE_DATA bila usaha berubah setelah pengajuan", async () => {
    const usaha = makeUsaha({
      findById: vi.fn().mockResolvedValue({
        id: "U1",
        managerId: "USER1",
        publishStatus: "published",
        updatedAt: new Date("2026-10-02T00:00:00Z"),
        createdAt: NOW,
        items: [],
      }),
    });
    const uc = build(makeContrib({ findById: vi.fn().mockResolvedValue(pendingRow()) }), usaha);
    await expect(uc.approve("C1", "ADMIN")).rejects.toMatchObject({
      errorCode: "STALE_DATA",
    });
  });

  it("approve dua kali 409 NOT_PENDING", async () => {
    const row = pendingRow({ status: "approved" });
    const uc = build(makeContrib({ findById: vi.fn().mockResolvedValue(row) }), makeUsaha());
    await expect(uc.approve("C1", "ADMIN")).rejects.toMatchObject({
      errorCode: "NOT_PENDING",
    });
  });

  it("resubmit hanya untuk kind=new berstatus needs_revision", async () => {
    const profile = pendingRow({ status: "needs_revision" });
    const uc = build(makeContrib({ findById: vi.fn().mockResolvedValue(profile) }), makeUsaha());
    await expect(
      uc.resubmit("USER1", "C1", { payload: newPayload, wantsClaim: false }),
    ).rejects.toMatchObject({ errorCode: "NOT_NEW_PROPOSAL" });

    const newRow = pendingRow({ kind: "new", status: "pending", usahaId: null });
    const uc2 = build(makeContrib({ findById: vi.fn().mockResolvedValue(newRow) }), makeUsaha());
    await expect(
      uc2.resubmit("USER1", "C1", { payload: newPayload, wantsClaim: false }),
    ).rejects.toMatchObject({ errorCode: "NOT_NEEDS_REVISION" });
  });
});
