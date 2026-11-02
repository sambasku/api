import { describe, it, expect, vi } from "vitest";
import {
  BadRequestError,
  ConflictError,
  NotFoundError,
} from "@/shared/errors/app-error";
import { EventContributionUseCases } from "../../application/event-contribution.use-cases";
import { composeEventRejectDisplay } from "../../domain/event-reject-reason";
import type {
  EventContribution,
  EventContributionPayload,
} from "../../domain/entities/event-contribution.entity";
import type { EventRepository } from "@/modules/event/domain/repositories/event.repository";
import type { RegionRepository } from "@/modules/region/domain/repositories/region.repository";
import type { CreateEventUseCase } from "@/modules/event/application/use-cases/event.use-cases";
import { ANONIM_USER_ID } from "@/shared/constants/anonim";

const USER_ID = "01USER000000000000000000001";

const payload: EventContributionPayload = {
  name: "Pawai Blocks",
  description: "Acara pawai blocks keywords.",
  categoryId: "budaya-tradisi",
  startsAt: "2026-11-01T09:00:00.000Z",
  endsAt: "2026-11-01T14:00:00.000Z",
  locationText: "Lapangan Pemangkat",
  lat: null,
  lng: null,
  mapsUrl: null,
  posterUrls: [],
  organizer: "Panitia",
  sourceUrl: "https://facebook.com/pawai.blocks",
  sourceType: "facebook",
  sourceAttribution: "@panitia",
  regionId: null,
  villageId: null,
  placeIds: [],
};

function makeRow(over: Partial<EventContribution> = {}): EventContribution {
  return {
    id: "01CONTRIB0000000000000000001",
    userId: USER_ID,
    eventId: null,
    payload,
    status: "pending",
    revisionNote: null,
    rejectReasonCode: null,
    rejectReasonText: null,
    createdAt: new Date("2026-10-01T00:00:00Z"),
    updatedAt: null,
    reviewedAt: null,
    ...over,
  };
}

function makeDeps() {
  const contrib = {
    create: vi.fn().mockResolvedValue(makeRow()),
    findById: vi.fn().mockResolvedValue(makeRow()),
    listByUser: vi.fn().mockResolvedValue([]),
    listByStatus: vi.fn().mockResolvedValue([]),
    remove: vi.fn().mockResolvedValue(undefined),
    setStatus: vi.fn().mockResolvedValue(undefined),
    replacePayload: vi.fn().mockResolvedValue(undefined),
    countPending: vi.fn().mockResolvedValue(0),
  };
  const events: Record<string, ReturnType<typeof vi.fn>> = {
    categoryRef: vi.fn().mockResolvedValue({ id: "budaya-tradisi", name: "Budaya" }),
    validPlaceIds: vi.fn().mockResolvedValue(new Set<string>()),
    existingSlugs: vi.fn().mockResolvedValue(new Set<string>()),
  };
  const regions: Record<string, ReturnType<typeof vi.fn>> = {
    findById: vi.fn().mockResolvedValue(null),
    findByIdOrSlug: vi.fn().mockResolvedValue(null),
  };
  const createEvent = {
    execute: vi.fn().mockResolvedValue({ id: "01EVENT0000000000000000001" }),
  } as unknown as CreateEventUseCase;
  const inbox = { execute: vi.fn().mockResolvedValue(undefined) };
  const notifyUser = { execute: vi.fn().mockResolvedValue(undefined) };

  const uc = new EventContributionUseCases(
    contrib as never,
    events as unknown as EventRepository,
    regions as unknown as RegionRepository,
    createEvent,
    inbox as never,
    notifyUser as never,
  );
  return { uc, contrib, events, regions, createEvent, inbox, notifyUser };
}

describe("EventContributionUseCases - submit", () => {
  it("simpan usulan sebagai pending", async () => {
    const { uc, contrib } = makeDeps();
    const row = await uc.submit(USER_ID, payload);
    expect(contrib.create).toHaveBeenCalledWith({
      userId: USER_ID,
      payload,
    });
    expect(row.status).toBe("pending");
  });

  it(".usulan anonim tetap diterima (tidak kena PENDING_CAP)", async () => {
    const { uc, contrib } = makeDeps();
    contrib.countPending.mockResolvedValue(99);
    await uc.submit(ANONIM_USER_ID, payload);
    expect(contrib.countPending).not.toHaveBeenCalled();
  });

  it("tolak kalau sudah 10 usulan pending", async () => {
    const { uc, contrib } = makeDeps();
    contrib.countPending.mockResolvedValue(10);
    await expect(uc.submit(USER_ID, payload)).rejects.toBeInstanceOf(
      ConflictError,
    );
  });

  it("tolak kategori yang tidak ada", async () => {
    const { uc, events } = makeDeps();
    events.categoryRef.mockResolvedValue(null);
    await expect(uc.submit(USER_ID, payload)).rejects.toBeInstanceOf(
      BadRequestError,
    );
  });

  it("tolak jadwal selesai sebelum mulai", async () => {
    const { uc } = makeDeps();
    await expect(
      uc.submit(USER_ID, {
        ...payload,
        endsAt: "2026-10-01T00:00:00.000Z",
      }),
    ).rejects.toBeInstanceOf(BadRequestError);
  });

  it("tolak lat tanpa lng", async () => {
    const { uc } = makeDeps();
    await expect(
      uc.submit(USER_ID, { ...payload, lat: 1.5, lng: null }),
    ).rejects.toBeInstanceOf(BadRequestError);
  });

  it("tolak desa yang bukan bagian dari kecamatan yang dipilih", async () => {
    const { uc, regions } = makeDeps();
    regions.findByIdOrSlug.mockImplementation(async (ref: string) =>
      ref === "01KEC000000000000000000001"
        ? {
            id: "01KEC000000000000000000001",
            type: "kecamatan",
            status: "published",
          }
        : {
            id: "01DESA00000000000000000001",
            type: "desa",
            status: "published",
            parentId: "01KECLAIN00000000000000001",
          },
    );
    await expect(
      uc.submit(USER_ID, {
        ...payload,
        regionId: "01KEC000000000000000000001",
        villageId: "01DESA00000000000000000001",
      }),
    ).rejects.toBeInstanceOf(BadRequestError);
  });

  it("slug wilayah dari katalog dinormalisasi jadi ULID", async () => {
    const { uc, contrib, regions } = makeDeps();
    regions.findByIdOrSlug.mockImplementation(async (ref: string) =>
      ref === "sejangkat"
        ? {
            id: "01KEC000000000000000000001",
            type: "kecamatan",
            status: "published",
          }
        : {
            id: "01DESA00000000000000000002",
            type: "desa",
            status: "published",
            parentId: "01KEC000000000000000000001",
          },
    );
    await uc.submit(USER_ID, {
      ...payload,
      regionId: "sejangkat",
      villageId: "sejangkat-batu",
    });
    expect(contrib.create).toHaveBeenCalledWith({
      userId: USER_ID,
      payload: expect.objectContaining({
        regionId: "01KEC000000000000000000001",
        villageId: "01DESA00000000000000000002",
      }),
    });
  });

  it("tolak place id yang tidak published", async () => {
    const { uc, events } = makeDeps();
    events.validPlaceIds.mockResolvedValue(new Set());
    await expect(
      uc.submit(USER_ID, {
        ...payload,
        placeIds: ["01PLACE00000000000000000001"],
      }),
    ).rejects.toBeInstanceOf(BadRequestError);
  });
});

describe("EventContributionUseCases - cancel", () => {
  it("hapus usulan milik sendiri yang masih pending", async () => {
    const { uc, contrib } = makeDeps();
    await uc.cancel(USER_ID, "01CONTRIB0000000000000000001");
    expect(contrib.remove).toHaveBeenCalledWith("01CONTRIB0000000000000000001");
  });

  it("tolak cancel usulan milik orang lain", async () => {
    const { uc, contrib } = makeDeps();
    contrib.findById.mockResolvedValue(makeRow({ userId: "01LAIN00000000000000000001" }));
    await expect(
      uc.cancel(USER_ID, "01CONTRIB0000000000000000001"),
    ).rejects.toBeInstanceOf(NotFoundError);
  });

  it("tolak cancel usulan yang sudah ditinjau", async () => {
    const { uc, contrib } = makeDeps();
    contrib.findById.mockResolvedValue(makeRow({ status: "approved" }));
    await expect(
      uc.cancel(USER_ID, "01CONTRIB0000000000000000001"),
    ).rejects.toBeInstanceOf(ConflictError);
  });
});

describe("EventContributionUseCases - resubmit", () => {
  it("ganti payload usulan yang butuh revisi", async () => {
    const { uc, contrib } = makeDeps();
    contrib.findById
      .mockResolvedValueOnce(makeRow({ status: "needs_revision" }))
      .mockResolvedValueOnce(makeRow({ status: "pending" }));
    const out = await uc.resubmit(USER_ID, "01CONTRIB0000000000000000001", {
      ...payload,
      name: "Pawai Blocks Revisi",
    });
    expect(contrib.replacePayload).toHaveBeenCalled();
    expect(out.status).toBe("pending");
  });

  it("tolak resubmit usulan yang tidak butuh revisi", async () => {
    const { uc } = makeDeps();
    await expect(
      uc.resubmit(USER_ID, "01CONTRIB0000000000000000001", payload),
    ).rejects.toBeInstanceOf(ConflictError);
  });
});

describe("EventContributionUseCases - approve", () => {
  it("buat event published dari payload", async () => {
    const { uc, createEvent, contrib } = makeDeps();
    await uc.approve("01CONTRIB0000000000000000001", "01ADMIN000000000000000001");
    expect(createEvent.execute).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "Pawai Blocks",
        status: "published",
        sourceUrl: "https://facebook.com/pawai.blocks",
      }),
    );
    expect(contrib.setStatus).toHaveBeenCalledWith(
      "01CONTRIB0000000000000000001",
      "approved",
      { eventId: "01EVENT0000000000000000001" },
    );
  });

  it("slug unik dari nama, cek sekali pakai batch IN", async () => {
    const { uc, events } = makeDeps();
    events.existingSlugs.mockResolvedValue(new Set(["pawai-blocks"]));
    await uc.approve("01CONTRIB0000000000000000001");
    expect(events.existingSlugs).toHaveBeenCalledTimes(1);
    expect(events.existingSlugs.mock.calls[0][0]).toContain("pawai-blocks-2");
  });

  it("tolak approve usulan yang bukan pending (idempoten)", async () => {
    const { uc, contrib } = makeDeps();
    contrib.findById.mockResolvedValue(makeRow({ status: "approved" }));
    await expect(
      uc.approve("01CONTRIB0000000000000000001"),
    ).rejects.toBeInstanceOf(ConflictError);
  });

  it("tolak approve usulan yang tidak ada", async () => {
    const { uc, contrib } = makeDeps();
    contrib.findById.mockResolvedValue(null);
    await expect(
      uc.approve("01CONTRIB0000000000000000001"),
    ).rejects.toBeInstanceOf(NotFoundError);
  });
});

describe("EventContributionUseCases - reject & revision", () => {
  it("simpan alasan penolakan", async () => {
    const { uc, contrib } = makeDeps();
    await uc.reject(
      "01CONTRIB0000000000000000001",
      "duplicate",
      "Sudah ada acara serupa.",
    );
    expect(contrib.setStatus).toHaveBeenCalledWith(
      "01CONTRIB0000000000000000001",
      "rejected",
      { rejectReasonCode: "duplicate", rejectReasonText: "Sudah ada acara serupa." },
    );
  });

  it("simpan catatan revisi", async () => {
    const { uc, contrib } = makeDeps();
    await uc.requestRevision(
      "01CONTRIB0000000000000000001",
      "Jadwalnya belum jelas.",
    );
    expect(contrib.setStatus).toHaveBeenCalledWith(
      "01CONTRIB0000000000000000001",
      "needs_revision",
      { revisionNote: "Jadwalnya belum jelas." },
    );
  });
});

describe("composeEventRejectDisplay", () => {
  it("tampilkan label saja tanpa catatan", () => {
    expect(composeEventRejectDisplay("duplicate")).toBe(
      "Sama dengan acara yang sudah terdaftar",
    );
  });

  it("gabungkan label dan catatan", () => {
    expect(composeEventRejectDisplay("duplicate", "Mirip festival lama")).toBe(
      "Sama dengan acara yang sudah terdaftar: Mirip festival lama",
    );
  });

  it("kode tak dikenal -> Ditolak", () => {
    expect(composeEventRejectDisplay("ngawur")).toBe("Ditolak");
  });
});
