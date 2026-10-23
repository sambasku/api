import type { Context } from "hono";
import type { AppVariables } from "@/shared/types";
import type { z } from "zod";
import type {
  CreateEventUseCase,
  DeleteEventUseCase,
  GetEventBySlugUseCase,
  ListEventCategoriesUseCase,
  ListEventsUseCase,
  SetEventCancelledUseCase,
  UpdateEventUseCase,
} from "../../application/use-cases/event.use-cases";
import { occurrenceStatus } from "../../domain/entities/event.entity";
import type {
  createEventBodySchema,
  listEventsQuerySchema,
  updateEventBodySchema,
} from "./validators/event.validator";

type CreateBody = z.infer<typeof createEventBodySchema>;
type UpdateBody = z.infer<typeof updateEventBodySchema>;

function serialize(
  event: {
    id: string;
    slug: string;
    name: string;
    description: string;
    categoryId: string;
    startsAt: Date;
    endsAt: Date;
    locationText: string;
    lat: number | null;
    lng: number | null;
    mapsUrl: string | null;
    posterUrls: string[];
    organizer: string | null;
    sourceUrl: string | null;
    sourceType: string | null;
    sourceAttribution: string | null;
    regionId: string | null;
    villageId: string | null;
    status: "draft" | "published" | "archived";
    cancelledAt: Date | null;
    publishedAt: Date | null;
    createdAt: Date;
    updatedAt: Date | null;
    places: Array<{
      id: string;
      slug: string;
      name: string;
      category: string | null;
    }>;
  },
  extra?: {
    category?: { id: string; name: string } | null;
    village?: { id: string; name: string; slug: string | null } | null;
  },
) {
  return {
    id: event.id,
    slug: event.slug,
    name: event.name,
    description: event.description,
    category_id: event.categoryId,
    category: extra?.category ?? null,
    starts_at: event.startsAt.toISOString(),
    ends_at: event.endsAt.toISOString(),
    occurrence_status: occurrenceStatus(event),
    location_text: event.locationText,
    lat: event.lat,
    lng: event.lng,
    maps_url: event.mapsUrl,
    poster_urls: event.posterUrls,
    organizer: event.organizer,
    source_url: event.sourceUrl,
    source_type: event.sourceType,
    source_attribution: event.sourceAttribution,
    region_id: event.regionId,
    village_id: event.villageId,
    village: extra?.village ?? null,
    places: event.places.map((p) => ({
      id: p.id,
      slug: p.slug,
      name: p.name,
      category: p.category,
    })),
    status: event.status,
    cancelled_at: event.cancelledAt ? event.cancelledAt.toISOString() : null,
    published_at: event.publishedAt ? event.publishedAt.toISOString() : null,
    created_at: event.createdAt.toISOString(),
    updated_at: event.updatedAt ? event.updatedAt.toISOString() : null,
  };
}

export class EventController {
  constructor(
    private readonly createUc: CreateEventUseCase,
    private readonly updateUc: UpdateEventUseCase,
    private readonly deleteUc: DeleteEventUseCase,
    private readonly listUc: ListEventsUseCase,
    private readonly getBySlugUc: GetEventBySlugUseCase,
    private readonly setCancelledUc: SetEventCancelledUseCase,
    private readonly listCategoriesUc: ListEventCategoriesUseCase,
  ) {}

  /**
   * Katalog kategori acara. Dipakai console (form select) + web (filter).
   * `publicOnly` false hanya untuk admin.
   */
  listCategories(c: Context<{ Variables: AppVariables }>, publicOnly: boolean) {
    return this.listCategoriesUc.execute(publicOnly).then((items) =>
      c.json({ success: true as const, data: { items } }),
    );
  }

  listPublic(
    c: Context<{ Variables: AppVariables }>,
    query: z.infer<typeof listEventsQuerySchema>,
  ) {
    return this.listUc
      .execute({
        limit: query.limit,
        before: query.before,
        categoryId: query.category_id,
        villageId: query.village_id,
        placeId: query.place_id,
        q: query.q,
        notEnded: query.not_ended === "1",
        order: query.order,
        publicOnly: true,
      })
      .then((res) =>
        c.json({
          success: true as const,
          data: {
            items: res.items.map((e) => serialize(e, {
              category: e.category,
              village: e.village,
            })),
            next_cursor: res.nextCursor,
          },
        }),
      );
  }

  getBySlug(c: Context<{ Variables: AppVariables }>, slug: string) {
    return this.getBySlugUc.execute(slug, true).then((event) =>
      c.json({
        success: true as const,
        data: serialize(event, {
          category: event.category,
          village: event.village,
        }),
      }),
    );
  }

  listAdmin(
    c: Context<{ Variables: AppVariables }>,
    query: z.infer<typeof listEventsQuerySchema>,
  ) {
    return this.listUc
      .execute({
        limit: query.limit,
        before: query.before,
        categoryId: query.category_id,
        villageId: query.village_id,
        placeId: query.place_id,
        q: query.q,
        status: query.status,
        notEnded: query.not_ended === "1",
        order: query.order,
      })
      .then((res) =>
        c.json({
          success: true as const,
          data: {
            items: res.items.map((e) =>
              serialize(e, { category: e.category, village: e.village }),
            ),
            next_cursor: res.nextCursor,
          },
        }),
      );
  }

  create(
    c: Context<{ Variables: AppVariables }>,
    body: CreateBody,
  ) {
    return this.createUc
      .execute({
        id: body.id,
        slug: body.slug,
        name: body.name,
        description: body.description,
        categoryId: body.category_id,
        startsAt: body.starts_at,
        endsAt: body.ends_at,
        locationText: body.location_text,
        lat: body.lat,
        lng: body.lng,
        mapsUrl: body.maps_url,
        posterUrls: body.poster_urls ?? [],
        organizer: body.organizer,
        sourceUrl: body.source_url,
        sourceType: body.source_type,
        sourceAttribution: body.source_attribution,
        regionId: body.region_id,
        villageId: body.village_id,
        placeIds: body.place_ids,
        authorId: body.author_id ?? c.get("user")?.user_id ?? null,
        status: body.status,
      })
      .then((event) =>
        c.json({
          success: true as const,
          data: serialize(event, {
            category: event.category,
            village: event.village,
          }),
        }),
      );
  }

  update(c: Context<{ Variables: AppVariables }>, id: string, body: UpdateBody) {
    return this.updateUc
      .execute({
        id,
        slug: body.slug,
        name: body.name,
        description: body.description,
        categoryId: body.category_id,
        startsAt: body.starts_at,
        endsAt: body.ends_at,
        locationText: body.location_text,
        lat: body.lat,
        lng: body.lng,
        mapsUrl: body.maps_url,
        posterUrls: body.poster_urls ?? [],
        organizer: body.organizer,
        sourceUrl: body.source_url,
        sourceType: body.source_type,
        sourceAttribution: body.source_attribution,
        regionId: body.region_id,
        villageId: body.village_id,
        placeIds: body.place_ids,
        status: body.status,
      })
      .then((event) =>
        c.json({
          success: true as const,
          data: serialize(event, {
            category: event.category,
            village: event.village,
          }),
        }),
      );
  }

  remove(c: Context<{ Variables: AppVariables }>, id: string) {
    return this.deleteUc.execute(id).then(() =>
      c.json({ success: true as const, data: null }),
    );
  }

  setCancelled(
    c: Context<{ Variables: AppVariables }>,
    id: string,
    body: { cancelled: boolean },
  ) {
    return this.setCancelledUc.execute(id, body.cancelled).then((event) =>
      c.json({
          success: true as const,
          data: serialize(event, {
            category: event.category,
            village: event.village,
          }),
        }),
    );
  }
}
