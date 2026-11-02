import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  BadRequestError,
  ConflictError,
  NotFoundError,
} from "@/shared/errors/app-error";
import {
  CreateEventUseCase,
  DeleteEventUseCase,
  GetEventBySlugUseCase,
  ListEventsUseCase,
  SetEventCancelledUseCase,
  UpdateEventUseCase,
} from "../../application/use-cases/event.use-cases";
import { occurrenceStatus } from "../../domain/entities/event.entity";
import type { EventRepository } from "../../domain/repositories/event.repository";
import type { RegionRepository } from "@/modules/region/domain/repositories/region.repository";

const NOW = new Date("2026-10-01T00:00:00Z");

const baseInput = {
  slug: "pawai-blocks",
  name: "Pawai Blocks",
  description: "Acara pawai blocks keywords.",
  categoryId: "budaya-tradisi",
  startsAt: new Date("2026-11-01T09:00:00Z"),
  endsAt: new Date("2026-11-01T14:00:00Z"),
  locationText: "Lapangan Pemangkat",
  status: "published" as const,
};

type Mock = Record<string, ReturnType<typeof vi.fn>>;

function makeRepo(over: Mock = {}) {
  return {
    create: vi.fn().mockResolvedValue({ id: "01EVENT0000000000000000001" }),
    update: vi.fn().mockResolvedValue({ id: "01EVENT0000000000000000001" }),
    softDelete: vi.fn().mockResolvedValue(true),
    findById: vi.fn().mockResolvedValue(null),
    findBySlug: vi.fn().mockResolvedValue(null),
    list: vi.fn().mockResolvedValue({ items: [], nextCursor: null }),
    setPlaces: vi.fn(),
    placesOf: vi.fn().mockResolvedValue([]),
    categoryRef: vi.fn().mockResolvedValue({ id: "budaya-tradisi", name: "Budaya" }),
    villageRef: vi.fn().mockResolvedValue(null),
    validPlaceIds: vi.fn().mockResolvedValue(new Set<string>()),
    existingSlugs: vi.fn().mockResolvedValue(new Set<string>()),
    ...over,
  } as unknown as Mock;
}

function makeRegions() {
  return {
    findById: vi.fn().mockResolvedValue(null),
  } as unknown as RegionRepository;
}

describe("occurrenceStatus", () => {
  const event = {
    startsAt: new Date("2026-10-01T09:00:00Z"),
    endsAt: new Date("2026-10-01T14:00:00Z"),
    cancelledAt: null,
  };

  it("upcoming sebelum mulai", () => {
    expect(occurrenceStatus(event, NOW)).toBe("upcoming");
  });

  it("ongoing di antara mulai dan selesai", () => {
    expect(occurrenceStatus(event, new Date("2026-10-01T10:00:00Z"))).toBe(
      "ongoing",
    );
  });

  it("completed setelah selesai", () => {
    expect(occurrenceStatus(event, new Date("2026-10-01T15:00:00Z"))).toBe(
      "completed",
    );
  });

  it("cancelled menang atas semua status lain", () => {
    expect(
      occurrenceStatus(
        { ...event, cancelledAt: new Date("2026-09-30T10:00:00Z") },
        new Date("2026-10-01T10:00:00Z"),
      ),
    ).toBe("cancelled");
  });
});

describe("CreateEventUseCase", () => {
  let repo: ReturnType<typeof makeRepo>;
  let regions: RegionRepository;
  let uc: CreateEventUseCase;

  beforeEach(() => {
    repo = makeRepo();
    regions = makeRegions();
    uc = new CreateEventUseCase(repo as unknown as EventRepository, regions);
  });

  it("catat event_published saat acara tayang (AGENTS.md #25)", async () => {
    const safe = vi.fn().mockResolvedValue(undefined);
    repo.create.mockResolvedValue({
      id: "01EVENT0000000000000000001",
      name: "Pawai Blocks",
      slug: "pawai-blocks",
      status: "published",
      authorId: "01USER00000000000000000001",
    });
    const ucWithActivity = new CreateEventUseCase(
      repo as unknown as EventRepository,
      regions,
      { safe } as never,
    );
    await ucWithActivity.execute(baseInput);
    expect(safe).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: "event_published",
        targetId: "01EVENT0000000000000000001",
        dedupeKey: "event_published:01EVENT0000000000000000001",
      }),
    );
  });

  it("draft tidak menulis event_published", async () => {
    const safe = vi.fn().mockResolvedValue(undefined);
    repo.create.mockResolvedValue({
      id: "01EVENT0000000000000000002",
      name: "Draft",
      slug: "draft",
      status: "draft",
      authorId: "01USER00000000000000000001",
    });
    const ucWithActivity = new CreateEventUseCase(
      repo as unknown as EventRepository,
      regions,
      { safe } as never,
    );
    await ucWithActivity.execute({ ...baseInput, status: "draft" });
    expect(safe).not.toHaveBeenCalled();
  });

  it("buat event valid", async () => {
    const out = await uc.execute(baseInput);
    expect(repo.create).toHaveBeenCalledWith(baseInput);
    expect(out).toBeTruthy();
  });

  it("tolak jadwal selesai sebelum mulai", async () => {
    await expect(
      uc.execute({
        ...baseInput,
        endsAt: new Date("2026-10-31T00:00:00Z"),
      }),
    ).rejects.toBeInstanceOf(BadRequestError);
  });

  it("tolak kategori yang tidak ada", async () => {
    repo.categoryRef.mockResolvedValue(null);
    await expect(uc.execute(baseInput)).rejects.toBeInstanceOf(BadRequestError);
  });

  it("tolak slug yang sudah dipakai", async () => {
    repo.findBySlug.mockResolvedValue({
      id: "01EVENTLAIN000000000000001",
    } as never);
    await expect(uc.execute(baseInput)).rejects.toBeInstanceOf(ConflictError);
  });

  it("tolak desa yang bukan desa published", async () => {
    (regions.findById as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: "01DESA00000000000000000001",
      type: "kecamatan",
      status: "published",
      parentId: null,
    });
    await expect(
      uc.execute({ ...baseInput, villageId: "01DESA00000000000000000001" }),
    ).rejects.toBeInstanceOf(BadRequestError);
  });

  it("tolak desa tanpa kecamatan parent", async () => {
    (regions.findById as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: "01DESA00000000000000000001",
      type: "desa",
      status: "published",
      parentId: null,
    });
    await expect(
      uc.execute({ ...baseInput, villageId: "01DESA00000000000000000001" }),
    ).rejects.toBeInstanceOf(BadRequestError);
  });

  it("tolak place id yang tidak valid", async () => {
    repo.validPlaceIds.mockResolvedValue(new Set());
    await expect(
      uc.execute({
        ...baseInput,
        placeIds: ["01PLACE00000000000000000001"],
      }),
    ).rejects.toBeInstanceOf(BadRequestError);
  });

  it("tolak place id dobel", async () => {
    await expect(
      uc.execute({
        ...baseInput,
        placeIds: ["01PLACE00000000000000000001", "01PLACE00000000000000000001"],
      }),
    ).rejects.toBeInstanceOf(BadRequestError);
  });
});

describe("UpdateEventUseCase", () => {
  let repo: ReturnType<typeof makeRepo>;
  let regions: RegionRepository;
  let uc: UpdateEventUseCase;

  beforeEach(() => {
    repo = makeRepo({
      findById: vi.fn().mockResolvedValue({
        id: "01EVENT0000000000000000001",
        slug: "pawai-blocks",
        startsAt: new Date("2026-11-01T09:00:00Z"),
        endsAt: new Date("2026-11-01T14:00:00Z"),
      }),
    });
    regions = makeRegions();
    uc = new UpdateEventUseCase(repo as unknown as EventRepository, regions);
  });

  it("update nama", async () => {
    await uc.execute({
      id: "01EVENT0000000000000000001",
      name: "Pawai Blocks 2026",
    });
    expect(repo.update).toHaveBeenCalled();
  });

  it("tolak update event yang tidak ada", async () => {
    repo.findById.mockResolvedValue(null);
    await expect(
      uc.execute({ id: "01EVENT0000000000000000001", name: "X" }),
    ).rejects.toBeInstanceOf(NotFoundError);
  });

  it("tolak jadwal baru yang selesai sebelum mulai lama", async () => {
    await expect(
      uc.execute({
        id: "01EVENT0000000000000000001",
        endsAt: new Date("2026-10-01T00:00:00Z"),
      }),
    ).rejects.toBeInstanceOf(BadRequestError);
  });

  it("tolak slug baru yang dipakai event lain", async () => {
    repo.findBySlug.mockResolvedValue({
      id: "01EVENTLAIN000000000000000001",
    } as never);
    await expect(
      uc.execute({
        id: "01EVENT0000000000000000001",
        slug: "dipakai",
      }),
    ).rejects.toBeInstanceOf(ConflictError);
  });
});

describe("DeleteEventUseCase", () => {
  it("soft delete event yang ada", async () => {
    const repo = makeRepo();
    await new DeleteEventUseCase(repo as unknown as EventRepository).execute("01EVENT0000000000000000001");
    expect(repo.softDelete).toHaveBeenCalledWith("01EVENT0000000000000000001");
  });

  it("tolak hapus event yang tidak ada", async () => {
    const repo = makeRepo({ softDelete: vi.fn().mockResolvedValue(false) });
    await expect(
      new DeleteEventUseCase(repo as unknown as EventRepository).execute("01EVENT0000000000000000001"),
    ).rejects.toBeInstanceOf(NotFoundError);
  });
});

describe("GetEventBySlugUseCase", () => {
  it("tolak slug yang tidak ada", async () => {
    const repo = makeRepo();
    await expect(
      new GetEventBySlugUseCase(repo as unknown as EventRepository).execute("tidak-ada"),
    ).rejects.toBeInstanceOf(NotFoundError);
  });
});

describe("ListEventsUseCase", () => {
  it("teruskan input ke repo", async () => {
    const repo = makeRepo();
    const input = { limit: 20, publicOnly: true, order: "asc" as const };
    await new ListEventsUseCase(repo as unknown as EventRepository).execute(input);
    expect(repo.list).toHaveBeenCalledWith(input);
  });
});

describe("SetEventCancelledUseCase", () => {
  it("batalkan event", async () => {
    const repo = makeRepo({
      findById: vi.fn().mockResolvedValue({
        id: "01EVENT0000000000000000001",
      }),
    });
    await new SetEventCancelledUseCase(repo as unknown as EventRepository).execute(
      "01EVENT0000000000000000001",
      true,
    );
    expect(repo.update).toHaveBeenCalledWith({
      id: "01EVENT0000000000000000001",
      cancelled: true,
    });
  });

  it("tolak event yang tidak ada", async () => {
    const repo = makeRepo();
    await expect(
      new SetEventCancelledUseCase(repo as unknown as EventRepository).execute(
        "01EVENT0000000000000000001",
        true,
      ),
    ).rejects.toBeInstanceOf(NotFoundError);
  });
});
