import type { Context } from "hono";
import { ANONIM_USER_ID } from "@/shared/constants/anonim";
import type { AppVariables } from "@/shared/types";
import type { z } from "zod";
import type { EventContribution } from "../../domain/entities/event-contribution.entity";
import type { EventContributionUseCases } from "../../application/event-contribution.use-cases";
import { composeEventRejectDisplay } from "../../domain/event-reject-reason";
import type { submitEventContributionBodySchema } from "./validators/event-contribution.validator";

function serialize(row: EventContribution) {
  const p = row.payload;
  return {
    id: row.id,
    user_id: row.userId,
    event_id: row.eventId,
    status: row.status,
    revision_note: row.revisionNote,
    reject_reason_code: row.rejectReasonCode,
    reject_reason_text: row.rejectReasonText,
    reject_reason_display: row.rejectReasonCode
      ? composeEventRejectDisplay(row.rejectReasonCode, row.rejectReasonText)
      : null,
    created_at: row.createdAt.toISOString(),
    updated_at: row.updatedAt ? row.updatedAt.toISOString() : null,
    reviewed_at: row.reviewedAt ? row.reviewedAt.toISOString() : null,
    payload: {
      name: p.name,
      description: p.description,
      category_id: p.categoryId,
      starts_at: p.startsAt,
      ends_at: p.endsAt,
      location_text: p.locationText,
      lat: p.lat,
      lng: p.lng,
      maps_url: p.mapsUrl,
      poster_urls: p.posterUrls ?? [],
      organizer: p.organizer,
      source_url: p.sourceUrl,
      source_type: p.sourceType,
      source_attribution: p.sourceAttribution,
      region_id: p.regionId,
      village_id: p.villageId,
      place_ids: p.placeIds,
    },
  };
}

function toPayload(body: z.infer<typeof submitEventContributionBodySchema>) {
  return {
    name: body.name,
    description: body.description,
    categoryId: body.category_id,
    startsAt: body.starts_at.toISOString(),
    endsAt: body.ends_at.toISOString(),
    locationText: body.location_text,
    lat: body.lat ?? null,
    lng: body.lng ?? null,
    mapsUrl: body.maps_url ?? null,
    posterUrls: body.poster_urls ?? [],
    organizer: body.organizer ?? null,
    sourceUrl: body.source_url ?? null,
    sourceType: body.source_type ?? null,
    sourceAttribution: body.source_attribution ?? null,
    regionId: body.region_id ?? null,
    villageId: body.village_id ?? null,
    placeIds: body.place_ids ?? [],
  };
}

export class EventContributionController {
  constructor(private readonly uc: EventContributionUseCases) {}

  submit(
    c: Context<{ Variables: AppVariables }>,
    body: z.infer<typeof submitEventContributionBodySchema>,
  ) {
    const userId = c.get("user")?.user_id ?? ANONIM_USER_ID;
    return this.uc
      .submit(userId, toPayload(body))
      .then((row) => c.json({ success: true as const, data: serialize(row) }));
  }

  mine(c: Context<{ Variables: AppVariables }>) {
    return this.uc
      .mine(c.get("user")!.user_id)
      .then((rows) =>
        c.json({ success: true as const, data: { items: rows.map(serialize) } }),
      );
  }

  cancel(c: Context<{ Variables: AppVariables }>, id: string) {
    return this.uc
      .cancel(c.get("user")!.user_id, id)
      .then(() => c.json({ success: true as const, data: null }));
  }

  resubmit(
    c: Context<{ Variables: AppVariables }>,
    id: string,
    body: z.infer<typeof submitEventContributionBodySchema>,
  ) {
    return this.uc
      .resubmit(c.get("user")!.user_id, id, toPayload(body))
      .then((row) => c.json({ success: true as const, data: serialize(row) }));
  }

  listPending(c: Context<{ Variables: AppVariables }>) {
    return this.uc
      .listPending()
      .then((rows) =>
        c.json({ success: true as const, data: { items: rows.map(serialize) } }),
      );
  }

  approve(c: Context<{ Variables: AppVariables }>, id: string) {
    const actorId = c.get("user")?.user_id;
    return this.uc
      .approve(id, actorId)
      .then(() => c.json({ success: true as const, data: null }));
  }

  reject(
    c: Context<{ Variables: AppVariables }>,
    id: string,
    body: { reason_code: string; reason_text?: string },
  ) {
    const actorId = c.get("user")?.user_id;
    return this.uc
      .reject(id, body.reason_code, body.reason_text ?? null, actorId)
      .then(() => c.json({ success: true as const, data: null }));
  }

  requestRevision(
    c: Context<{ Variables: AppVariables }>,
    id: string,
    body: { note: string },
  ) {
    const actorId = c.get("user")?.user_id;
    return this.uc
      .requestRevision(id, body.note, actorId)
      .then(() => c.json({ success: true as const, data: null }));
  }
}
