import type { RegionRepository } from "@/modules/region/domain/repositories/region.repository";
import type { NotifyUserUseCase } from "@/modules/device/application/use-cases/notify-user.use-case";
import type { InboxNotificationType } from "@/modules/notification/domain/entities/notification.entity";
import type { RecordInboxNotificationUseCase } from "@/modules/notification/application/use-cases/record-inbox-notification.use-case";
import {
  CreateEventUseCase,
} from "@/modules/event/application/use-cases/event.use-cases";
import type { EventRepository } from "@/modules/event/domain/repositories/event.repository";
import { ANONIM_USER_ID } from "@/shared/constants/anonim";
import {
  BadRequestError,
  ConflictError,
  NotFoundError,
} from "@/shared/errors/app-error";
import { composeEventRejectDisplay } from "../domain/event-reject-reason";
import type {
  EventContribution,
  EventContributionPayload,
} from "../domain/entities/event-contribution.entity";
import type { EventContributionRepositoryImpl } from "../infrastructure/event-contribution.repository.impl";

const PENDING_CAP = 10;

/** Copy notifikasi inbox + FCM untuk keputusan usulan acara. */
function decisionCopy(
  kind: "approved" | "rejected" | "needs_revision",
  name: string,
  opts?: {
    rejectReason?: { code: string; text?: string | null };
    revisionNote?: string | null;
  },
): { title: string; body: string } {
  if (kind === "approved") {
    return {
      title: "Usulan acara disetujui",
      body: `Usulanmu "${name}" sudah tayang di daftar acara. Terima kasih!`,
    };
  }
  if (kind === "needs_revision") {
    const note = opts?.revisionNote
      ? ` Catatan: ${opts.revisionNote}.`
      : "";
    return {
      title: "Usulan acara perlu revisi",
      body: `Usulanmu "${name}" perlu diperbaiki dulu.${note} Buka daftar usulan untuk detailnya.`,
    };
  }
  const reason = opts?.rejectReason
    ? ` Alasan: ${composeEventRejectDisplay(opts.rejectReason.code, opts.rejectReason.text)}.`
    : "";
  return {
    title: "Usulan acara ditolak",
    body: `Usulanmu "${name}" ditolak.${reason} Buka daftar usulan untuk detailnya.`,
  };
}

export class EventContributionUseCases {
  constructor(
    private readonly contrib: EventContributionRepositoryImpl,
    private readonly events: EventRepository,
    private readonly regions: RegionRepository,
    private readonly createEvent: CreateEventUseCase,
    private readonly inbox?: RecordInboxNotificationUseCase,
    private readonly notifyUser?: NotifyUserUseCase,
  ) {}

  async submit(
    userId: string,
    payload: EventContributionPayload,
  ): Promise<EventContribution> {
    await this.assertPayload(payload);
    const anon = userId === ANONIM_USER_ID;
    if (!anon && (await this.contrib.countPending(userId)) >= PENDING_CAP) {
      throw new ConflictError(
        "PENDING_CAP",
        "Maksimal 10 usulan yang masih menunggu",
      );
    }
    return this.contrib.create({ userId, payload });
  }

  async mine(userId: string): Promise<EventContribution[]> {
    return this.contrib.listByUser(userId);
  }

  async cancel(userId: string, id: string): Promise<void> {
    const row = await this.contrib.findById(id);
    if (!row || row.userId !== userId) {
      throw new NotFoundError(
        "CONTRIBUTION_NOT_FOUND",
        "Usulan tidak ditemukan",
      );
    }
    if (row.status !== "pending" && row.status !== "needs_revision") {
      throw new ConflictError("NOT_PENDING", "Usulan sudah ditinjau");
    }
    await this.contrib.remove(id);
  }

  async listPending(): Promise<EventContribution[]> {
    return this.contrib.listByStatus("pending");
  }

  /** Kirim ulang usulan yang diminta revisi (payload baru). */
  async resubmit(
    userId: string,
    id: string,
    payload: EventContributionPayload,
  ): Promise<EventContribution> {
    const row = await this.contrib.findById(id);
    if (!row || row.userId !== userId) {
      throw new NotFoundError(
        "CONTRIBUTION_NOT_FOUND",
        "Usulan tidak ditemukan",
      );
    }
    if (row.status !== "needs_revision") {
      throw new ConflictError(
        "NOT_NEEDS_REVISION",
        "Usulan ini tidak menunggu revisi",
      );
    }
    await this.assertPayload(payload);
    await this.contrib.replacePayload(id, payload);
    const updated = await this.contrib.findById(id);
    if (!updated) throw new Error("resubmit gagal - row hilang");
    return updated;
  }

  /**
   * Approve = buat event `published` langsung dari payload (pola place).
   * `mustPending` guard bikin idempoten: klik ganda tidak bikin event dobel.
   */
  async approve(id: string, actorId?: string): Promise<void> {
    const row = await this.mustPending(id);
    const p = row.payload;
    const event = await this.createEvent.execute({
      slug: await this.uniqueSlug(p.name),
      name: p.name,
      description: p.description,
      categoryId: p.categoryId,
      startsAt: new Date(p.startsAt),
      endsAt: new Date(p.endsAt),
      locationText: p.locationText,
      lat: p.lat,
      lng: p.lng,
      mapsUrl: p.mapsUrl,
      posterUrls: p.posterUrls ?? [],
      organizer: p.organizer,
      sourceUrl: p.sourceUrl,
      sourceType: p.sourceType,
      sourceAttribution: p.sourceAttribution,
      regionId: p.regionId,
      villageId: p.villageId,
      placeIds: p.placeIds,
      authorId: row.userId === ANONIM_USER_ID ? null : row.userId,
      status: "published",
    });
    await this.contrib.setStatus(id, "approved", { eventId: event.id });
    await this.notifyDecision(row, "approved", undefined, actorId);
  }

  async reject(
    id: string,
    reasonCode: string,
    reasonText?: string | null,
    actorId?: string,
  ): Promise<void> {
    const row = await this.mustPending(id);
    await this.contrib.setStatus(id, "rejected", {
      rejectReasonCode: reasonCode,
      rejectReasonText: reasonText ?? null,
    });
    await this.notifyDecision(
      row,
      "rejected",
      { rejectReason: { code: reasonCode, text: reasonText } },
      actorId,
    );
  }

  async requestRevision(
    id: string,
    note: string,
    actorId?: string,
  ): Promise<void> {
    const row = await this.mustPending(id);
    await this.contrib.setStatus(id, "needs_revision", {
      revisionNote: note,
    });
    await this.notifyDecision(
      row,
      "needs_revision",
      { revisionNote: note },
      actorId,
    );
  }

  /**
   * Slug unik dari nama acara. Semua kandidat dicek dalam 1 query IN
   * (bukan loop query per kandidat - rule subrequest).
   */
  private async uniqueSlug(name: string): Promise<string> {
    const base =
      name
        .toLowerCase()
        .normalize("NFKD")
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .slice(0, 80) || "acara";
    const candidates = [base];
    for (let i = 2; i <= 20; i++) candidates.push(`${base}-${i}`);
    const taken = await this.events.existingSlugs(candidates);
    for (const slug of candidates) {
      if (!taken.has(slug)) return slug;
    }
    return `${base}-${Date.now()}`;
  }

  /**
   * Inbox + FCM push ke pengusul. Best-effort setelah keputusan tersimpan:
   * notifikasi gagal tidak membatalkan keputusan. Self-review di-skip.
   */
  private async notifyDecision(
    row: EventContribution,
    kind: "approved" | "rejected" | "needs_revision",
    opts?: {
      rejectReason?: { code: string; text?: string | null };
      revisionNote?: string | null;
    },
    actorId?: string,
  ): Promise<void> {
    if (actorId && actorId === row.userId) return;
    const copy = decisionCopy(kind, row.payload.name, opts);
    const type: InboxNotificationType =
      kind === "approved"
        ? "event_contribution_approved"
        : kind === "rejected"
          ? "event_contribution_rejected"
          : "event_contribution_needs_revision";
    const data = {
      type,
      target_kind: "event_contribution",
      target_id: row.id,
    };
    try {
      await this.inbox?.execute({
        userId: row.userId,
        type,
        targetKind: "event_contribution",
        targetId: row.id,
        title: copy.title,
        body: copy.body,
        actionKind: "event_contribution",
        actionValue: row.id,
        actorId,
      });
      await this.notifyUser?.execute({
        userId: row.userId,
        title: copy.title,
        body: copy.body,
        data,
        actorId,
      });
    } catch (err) {
      console.error(
        JSON.stringify({
          level: "error",
          msg: "notifikasi keputusan usulan acara gagal",
          contribution_id: row.id,
          kind,
          error: err instanceof Error ? err.message : String(err),
        }),
      );
    }
  }

  private async mustPending(id: string): Promise<EventContribution> {
    const row = await this.contrib.findById(id);
    if (!row) {
      throw new NotFoundError(
        "CONTRIBUTION_NOT_FOUND",
        "Usulan tidak ditemukan",
      );
    }
    if (row.status !== "pending") {
      throw new ConflictError("NOT_PENDING", "Usulan sudah ditinjau");
    }
    return row;
  }

  private async assertPayload(
    payload: EventContributionPayload,
  ): Promise<void> {
    const hasLat = payload.lat != null;
    const hasLng = payload.lng != null;
    if (hasLat !== hasLng) {
      throw new BadRequestError(
        "LATLNG_PAIR",
        "Latitude dan longitude harus diisi berpasangan",
      );
    }
    const category = await this.events.categoryRef(payload.categoryId);
    if (!category) {
      throw new BadRequestError(
        "CATEGORY_NOT_FOUND",
        "Kategori acara tidak ditemukan",
      );
    }
    const startsAt = new Date(payload.startsAt);
    const endsAt = new Date(payload.endsAt);
    if (Number.isNaN(startsAt.getTime()) || Number.isNaN(endsAt.getTime())) {
      throw new BadRequestError(
        "INVALID_SCHEDULE",
        "Jadwal acara tidak valid",
      );
    }
    if (endsAt.getTime() < startsAt.getTime()) {
      throw new BadRequestError(
        "INVALID_SCHEDULE",
        "Waktu selesai tidak boleh sebelum waktu mulai",
      );
    }
    if (payload.regionId) {
      const region = await this.regions.findById(payload.regionId);
      if (!region || region.type !== "kecamatan" || region.status !== "published") {
        throw new BadRequestError(
          "REGION_NOT_FOUND",
          "Kecamatan tidak ditemukan",
        );
      }
    }
    if (payload.villageId) {
      const village = await this.regions.findById(payload.villageId);
      if (!village || village.type !== "desa" || village.status !== "published") {
        throw new BadRequestError(
          "VILLAGE_NOT_FOUND",
          "Desa tidak ditemukan",
        );
      }
      if (payload.regionId && village.parentId !== payload.regionId) {
        throw new BadRequestError(
          "VILLAGE_MISMATCH",
          "Desa bukan bagian dari kecamatan yang dipilih",
        );
      }
    }
    if (payload.placeIds.length > 0) {
      const valid = await this.events.validPlaceIds(payload.placeIds);
      for (const id of payload.placeIds) {
        if (!valid.has(id)) {
          throw new BadRequestError(
            "PLACE_NOT_FOUND",
            "Tempat wisata tidak ditemukan atau belum published",
          );
        }
      }
    }
  }
}
