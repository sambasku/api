import {
  BadRequestError,
  ConflictError,
  NotFoundError,
} from "@/shared/errors/app-error";
import type { RegionRepository } from "@/modules/region/domain/repositories/region.repository";
import type { RecordActivityEventUseCase } from "@/modules/activity/application/use-cases/record-activity-event.use-case";
import { ANONIM_USER_ID } from "@/shared/constants/anonim";
import type {
  EventCategoryRef,
  EventListItem,
} from "../../domain/entities/event.entity";
import type {
  CreateEventInput,
  ListEventsInput,
  ListEventsResult,
  EventRepository,
  UpdateEventInput,
} from "../../domain/repositories/event.repository";

async function assertCategoryPublished(
  repo: EventRepository,
  categoryId: string,
): Promise<void> {
  const ref = await repo.categoryRef(categoryId);
  if (!ref) {
    throw new BadRequestError(
      "CATEGORY_NOT_FOUND",
      "Kategori acara tidak ditemukan",
      [{ field: "categoryId", message: "Pilih kategori yang valid" }],
    );
  }
}

async function assertVillage(
  regions: RegionRepository,
  villageId: string | null | undefined,
): Promise<void> {
  if (!villageId) return;
  const village = await regions.findById(villageId);
  if (!village || village.type !== "desa" || village.status !== "published") {
    throw new BadRequestError(
      "VILLAGE_NOT_FOUND",
      "Desa tidak ditemukan atau belum published",
      [{ field: "villageId", message: "Pilih desa yang valid" }],
    );
  }
  if (!village.parentId) {
    throw new BadRequestError(
      "VILLAGE_NO_PARENT",
      "Desa harus punya kecamatan (parentId)",
      [{ field: "villageId", message: "Desa tanpa kecamatan tidak valid" }],
    );
  }
}

async function assertPlaces(
  repo: EventRepository,
  placeIds: string[] | undefined,
): Promise<void> {
  if (!placeIds?.length) return;
  const seen = new Set<string>();
  for (const id of placeIds) {
    if (seen.has(id)) {
      throw new BadRequestError(
        "PLACE_DUPLICATE",
        "Tempat wisata tidak boleh dobel",
        [{ field: "placeIds", message: `Tempat wisata ${id} dobel` }],
      );
    }
    seen.add(id);
  }
  // Batch: satu query IN, bukan per-id (rule subrequest).
  const valid = await repo.validPlaceIds(placeIds);
  for (const id of placeIds) {
    if (!valid.has(id)) {
      throw new BadRequestError(
        "PLACE_NOT_FOUND",
        "Tempat wisata tidak ditemukan atau belum published",
        [{ field: "placeIds", message: `Tempat wisata ${id} tidak valid` }],
      );
    }
  }
}

export class CreateEventUseCase {
  constructor(
    private readonly repo: EventRepository,
    private readonly regions: RegionRepository,
    private readonly activityEvents?: RecordActivityEventUseCase,
  ) {}

  async execute(input: CreateEventInput): Promise<EventListItem> {
    if (input.endsAt < input.startsAt) {
      throw new BadRequestError(
        "INVALID_SCHEDULE",
        "Waktu selesai tidak boleh sebelum mulai",
        [{ field: "endsAt", message: "Harus >= waktu mulai" }],
      );
    }
    await assertCategoryPublished(this.repo, input.categoryId);
    await assertVillage(this.regions, input.villageId);
    await assertPlaces(this.repo, input.placeIds);
    const existing = await this.repo.findBySlug(input.slug);
    if (existing) {
      throw new ConflictError("SLUG_TAKEN", "Slug event sudah dipakai");
    }
    const event = await this.repo.create(input);
    // Activity feed: acara tayang pertama kali = event activity (AGENTS.md #25).
    if (event.status === "published") {
      await this.recordPublished(event.id, event.name, input.authorId ?? null);
    }
    return event;
  }

  /**
   * Activity `event_published` (AGENTS.md #25) - best-effort. Dedupe key
   * per event: draft->published ulang tidak bikin feed dobel.
   */
  private async recordPublished(
    eventId: string,
    name: string,
    authorId: string | null,
  ): Promise<void> {
    await recordEventPublished(this.activityEvents, eventId, name, authorId);
  }
}

/** Activity `event_published` (AGENTS.md #25) - best-effort, dedupe per acara. */
async function recordEventPublished(
  activityEvents: RecordActivityEventUseCase | undefined,
  eventId: string,
  name: string,
  authorId: string | null,
): Promise<void> {
  await activityEvents?.safe({
    kind: "event_published",
    payload: `Menambahkan acara · "${name}"`,
    // Anonim = null actor: feed tetap ada jejak "acara baru" tanpa
    // membocorkan identitas (pola usaha_published).
    actorId: authorId && authorId !== ANONIM_USER_ID ? authorId : null,
    targetId: eventId,
    dedupeKey: `event_published:${eventId}`,
  });
}

export class UpdateEventUseCase {
  constructor(
    private readonly repo: EventRepository,
    private readonly regions: RegionRepository,
    private readonly activityEvents?: RecordActivityEventUseCase,
  ) {}

  async execute(input: UpdateEventInput): Promise<EventListItem> {
    const existing = await this.repo.findById(input.id);
    if (!existing) {
      throw new NotFoundError("EVENT_NOT_FOUND", "Event tidak ditemukan");
    }
    const startsAt = input.startsAt ?? existing.startsAt;
    const endsAt = input.endsAt ?? existing.endsAt;
    if (endsAt < startsAt) {
      throw new BadRequestError(
        "INVALID_SCHEDULE",
        "Waktu selesai tidak boleh sebelum mulai",
        [{ field: "endsAt", message: "Harus >= waktu mulai" }],
      );
    }
    if (input.categoryId) {
      await assertCategoryPublished(this.repo, input.categoryId);
    }
    if (input.villageId !== undefined) {
      await assertVillage(this.regions, input.villageId);
    }
    if (input.placeIds !== undefined) {
      await assertPlaces(this.repo, input.placeIds);
    }
    if (input.slug && input.slug !== existing.slug) {
      const other = await this.repo.findBySlug(input.slug);
      if (other) {
        throw new ConflictError("SLUG_TAKEN", "Slug event sudah dipakai");
      }
    }
    const updated = await this.repo.update(input);
    if (!updated) {
      throw new NotFoundError("EVENT_NOT_FOUND", "Event tidak ditemukan");
    }
    // Activity feed: draft -> published pertama kali = acara tayang (AGENTS.md #25).
    if (updated.status === "published" && existing.status !== "published") {
      await recordEventPublished(
        this.activityEvents,
        updated.id,
        updated.name,
        updated.authorId ?? null,
      );
    }
    return updated;
  }
}

export class DeleteEventUseCase {
  constructor(private readonly repo: EventRepository) {}

  async execute(id: string): Promise<void> {
    const ok = await this.repo.softDelete(id);
    if (!ok) {
      throw new NotFoundError("EVENT_NOT_FOUND", "Event tidak ditemukan");
    }
  }
}

export class ListEventsUseCase {
  constructor(private readonly repo: EventRepository) {}

  execute(input: ListEventsInput): Promise<ListEventsResult> {
    return this.repo.list(input);
  }
}

export class GetEventBySlugUseCase {
  constructor(private readonly repo: EventRepository) {}

  async execute(slug: string, publicOnly = true): Promise<EventListItem> {
    const event = await this.repo.findBySlug(slug, { publicOnly });
    if (!event) {
      throw new NotFoundError("EVENT_NOT_FOUND", "Event tidak ditemukan");
    }
    return event;
  }
}

export class SetEventCancelledUseCase {
  constructor(private readonly repo: EventRepository) {}

  /**
   * Tandai batal/pulihkan. Status pelaksanaan lain diturunkan read-time -
   * di sini hanya kolom `cancelled_at` yang berubah.
   */
  async execute(id: string, cancelled: boolean): Promise<EventListItem> {
    const existing = await this.repo.findById(id);
    if (!existing) {
      throw new NotFoundError("EVENT_NOT_FOUND", "Event tidak ditemukan");
    }
    const updated = await this.repo.update({ id, cancelled });
    if (!updated) {
      throw new NotFoundError("EVENT_NOT_FOUND", "Event tidak ditemukan");
    }
    return updated;
  }
}

/**
 * Katalog kategori acara. Dipakai form select di console + filter kategori
 * di web. `publicOnly` = hanya kategori published.
 */
export class ListEventCategoriesUseCase {
  constructor(private readonly repo: EventRepository) {}

  execute(publicOnly = true): Promise<EventCategoryRef[]> {
    return this.repo.listCategories(publicOnly);
  }
}
