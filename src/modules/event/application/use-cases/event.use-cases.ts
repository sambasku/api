import {
BadRequestError,
ConflictError,
NotFoundError,
RateLimitedError,
UnauthorizedError,
} from "@/shared/errors/app-error";
import type { RegionRepository } from "@/modules/region/domain/repositories/region.repository";
import type { UserRepository } from "@/modules/auth/domain/repositories/user.repository";
import type { RecordActivityEventUseCase } from "@/modules/activity/application/use-cases/record-activity-event.use-case";
import {
  EXPLORE_PHOTO_GROUP_EVENT_KEY,
  type ExplorationGroupNotifier,
} from "@/modules/wa/application/ports/exploration-group-notifier.port";
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

/** Resolve slug/ULID desa → ULID published; null jika kosong. */
async function resolveVillage(
  regions: RegionRepository,
  villageId: string | null | undefined,
): Promise<string | null> {
  if (!villageId) return null;
  const village = await regions.findByIdOrSlug(villageId);
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
  return village.id;
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
    if (
      input.startsAt &&
      input.endsAt &&
      input.endsAt.getTime() < input.startsAt.getTime()
    ) {
      throw new BadRequestError(
        "INVALID_SCHEDULE",
        "Waktu selesai tidak boleh sebelum mulai",
        [{ field: "endsAt", message: "Harus >= waktu mulai" }],
      );
    }
    await assertCategoryPublished(this.repo, input.categoryId);
    const villageId = await resolveVillage(this.regions, input.villageId);
    await assertPlaces(this.repo, input.placeIds);
    const existing = await this.repo.findBySlug(input.slug);
    if (existing) {
      throw new ConflictError("SLUG_TAKEN", "Slug event sudah dipakai");
    }
    const event = await this.repo.create({
      ...input,
      villageId,
    });
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
    const startsAt =
      input.startsAt !== undefined ? input.startsAt : existing.startsAt;
    const endsAt = input.endsAt !== undefined ? input.endsAt : existing.endsAt;
    if (
      startsAt &&
      endsAt &&
      endsAt.getTime() < startsAt.getTime()
    ) {
      throw new BadRequestError(
        "INVALID_SCHEDULE",
        "Waktu selesai tidak boleh sebelum mulai",
        [{ field: "endsAt", message: "Harus >= waktu mulai" }],
      );
    }
    if (input.categoryId) {
      await assertCategoryPublished(this.repo, input.categoryId);
    }
    let villageId = input.villageId;
    if (input.villageId !== undefined) {
      villageId = await resolveVillage(this.regions, input.villageId);
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
    const updated = await this.repo.update({
      ...input,
      ...(input.villageId !== undefined ? { villageId } : {}),
    });
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

/** Galeri 12 foto per halaman (pola GALLERY_PAGE place). */
const GALLERY_PAGE = 12;
/** Batas total foto per acara. */
const PHOTO_CAP = 100;
/** Batas unggahan per user per acara per 24 jam. */
const PHOTO_DAILY = 5;
/** Batas foto per satu kali submit (permintaan fitur). */
const PHOTO_PER_SUBMIT = 4;

export class ListEventImagesUseCase {
  constructor(private readonly repo: EventRepository) {}

  async execute(slug: string, offset: number) {
    const event = await this.repo.findBySlug(slug, { publicOnly: true });
    if (!event) {
      throw new NotFoundError("EVENT_NOT_FOUND", "Acara tidak ditemukan");
    }
    const page = await this.repo.listImages(event.id, offset, GALLERY_PAGE);
    const next =
      offset + page.items.length < page.total
        ? offset + page.items.length
        : null;
    return { items: page.items, total: page.total, nextOffset: next };
  }
}

export class AppendEventImagesUseCase {
  constructor(
    private readonly repo: EventRepository,
    private readonly users: UserRepository,
    private readonly activityEvents?: RecordActivityEventUseCase,
    private readonly groupNotifier?: ExplorationGroupNotifier,
  ) {}

  async execute(slug: string, authorId: string, urls: string[]): Promise<void> {
    // Foto acara tayang publik + masuk feed -> wajib akun.
    if (authorId === ANONIM_USER_ID) {
      throw new UnauthorizedError(
        "UNAUTHORIZED",
        "Masuk dulu untuk menambah foto acara",
      );
    }
    if (urls.length > PHOTO_PER_SUBMIT) {
      throw new BadRequestError(
        "PHOTO_LIMIT",
        `Maksimal ${PHOTO_PER_SUBMIT} foto per kiriman`,
      );
    }
    const event = await this.repo.findBySlug(slug, { publicOnly: true });
    if (!event || event.status !== "published") {
      throw new NotFoundError("EVENT_NOT_FOUND", "Acara tidak ditemukan");
    }
    for (const url of urls) assertOurEventImage(url);

    const total = (await this.repo.listImages(event.id, 0, 1)).total;
    if (total + urls.length > PHOTO_CAP) {
      throw new BadRequestError(
        "PHOTO_CAP",
        "Foto acara ini sudah penuh (100)",
      );
    }

    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const today = await this.repo.countUploadsSince(event.id, authorId, since);
    if (today + urls.length > PHOTO_DAILY) {
      throw new RateLimitedError("Maksimal 5 foto per acara dalam 24 jam");
    }

    const page = await this.repo.listImages(event.id, 0, PHOTO_CAP);
    const have = new Set(page.items.map((img) => img.url));
    const fresh = urls.filter((url) => !have.has(url));
    if (fresh.length === 0) return;

    // Nama penulis dari user repo (pola AppendPlaceImagesUseCase).
    const user = await this.users.findById(authorId);
    if (!user) {
      throw new NotFoundError("USER_NOT_FOUND", "User tidak ditemukan");
    }
    const name = user.displayName || user.username;
    await this.repo.appendImages(
      event.id,
      fresh.map((url) => ({
        url,
        attribution: { name, provider: "sambasku", authorId },
      })),
    );

    // Satu event per batch unggah (pola place_photo_added #187).
    await this.activityEvents?.safe({
      kind: "event_photo_added",
      actorId: authorId,
      targetId: event.id,
      dedupeKey: `event_photo:${event.id}:${fresh.join("|")}`,
      payload: `Menambahkan foto acara ${event.name}`,
    });
    try {
      await this.groupNotifier?.notify({
        heading: "Foto baru tayang.",
        jenis: "Foto Acara",
        name: `${event.name} (${fresh.length} foto)`,
        userId: authorId,
        eventKey: EXPLORE_PHOTO_GROUP_EVENT_KEY,
      });
    } catch {
      // Gagal kirim grup tidak membatalkan unggah foto.
    }
  }
}

/**
 * Takedown foto acara oleh admin. Foto disembunyikan permanen (soft-hide,
 * berkas tetap di CDN) lalu event feed yang menyebut URL itu ikut
 * disembunyikan.
 */
export class HideEventImageUseCase {
  constructor(
    private readonly repo: EventRepository,
    private readonly activityEvents?: RecordActivityEventUseCase,
  ) {}

  async execute(eventId: string, imageId: string): Promise<void> {
    const image = await this.repo.hideImage(eventId, imageId);
    if (!image) {
      throw new NotFoundError("IMAGE_NOT_FOUND", "Foto tidak ditemukan");
    }
    await this.activityEvents?.safeHidePlacePhoto(eventId, image.url);
  }
}

/** Foto acara wajib hasil unggah SambasKu (CDN jsdelivr assets/events). */
export function assertOurEventImage(url: string): void {
  if (
    !url.startsWith("https://cdn.jsdelivr.net/") ||
    !url.includes("/assets/events/")
  ) {
    throw new BadRequestError("IMAGE_URL", "Foto harus hasil unggah SambasKu");
  }
}
