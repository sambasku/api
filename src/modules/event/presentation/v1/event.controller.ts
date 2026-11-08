import type { Context } from "hono";
import type { AppVariables, AuthUser } from "@/shared/types";
import { UnauthorizedError } from "@/shared/errors/app-error";
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
import type {
  CreateEventCommentUseCase,
  DeleteEventCommentUseCase,
  ListEventCommentsUseCase,
  TakedownEventCommentUseCase,
  UpdateEventCommentUseCase,
} from "../../application/use-cases/event-comment.use-cases";
import { occurrenceStatus } from "../../domain/entities/event.entity";
import type { EventComment } from "../../domain/entities/event.entity";
import type { EventGoingRepository } from "@/modules/event-going/domain/repositories/event-going.repository";
import { isVerifierRole } from "@/modules/word/application/utils/resolve-publication";
import type {
  createEventBodySchema,
  listEventsQuerySchema,
  updateEventBodySchema,
} from "./validators/event.validator";

function requireUser(c: Context<{ Variables: AppVariables }>): AuthUser {
  const user = c.get('user');
  if (!user) throw new UnauthorizedError();
  return user;
}

function toCommentWire(c: EventComment) {
  const deleted = c.authorDeletedAt !== null;
  return {
    id: c.id,
    event_id: c.eventId,
    user: {
      user_id: c.userId,
      username: deleted ? null : c.username,
      display_name: deleted ? null : c.displayName,
      avatar_url: deleted ? null : c.avatarUrl,
      is_verifier: !deleted && isVerifierRole(c.userRole ?? ''),
    },
    body: c.body,
    status: c.status,
    is_edited: c.isEdited,
    created_at: c.createdAt.toISOString(),
    updated_at: c.updatedAt?.toISOString() ?? null,
  };
}

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
    authorId?: string | null;
    author?: {
      id: string;
      username: string;
      displayName: string;
    } | null;
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
    goingCount?: number;
    viewerGoing?: boolean;
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
    author_id: event.authorId ?? null,
    author: event.author
      ? {
          id: event.author.id,
          username: event.author.username,
          display_name: event.author.displayName,
        }
      : null,
    going_count: extra?.goingCount ?? 0,
    viewer_going: extra?.viewerGoing ?? false,
    created_at: event.createdAt.toISOString(),
    updated_at: event.updatedAt ? event.updatedAt.toISOString() : null,
  };
}

export interface EventCommentControllerDeps {
  listComments: ListEventCommentsUseCase;
  createComment: CreateEventCommentUseCase;
  updateComment: UpdateEventCommentUseCase;
  deleteComment: DeleteEventCommentUseCase;
  takedownComment: TakedownEventCommentUseCase;
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
    private readonly commentDeps?: EventCommentControllerDeps,
    private readonly goingRepo?: EventGoingRepository,
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

  async listPublic(
    c: Context<{ Variables: AppVariables }>,
    query: z.infer<typeof listEventsQuerySchema>,
  ) {
    const res = await this.listUc.execute({
      limit: query.limit,
      before: query.before,
      categoryId: query.category_id,
      villageId: query.village_id,
      regionId: query.region_id,
      placeId: query.place_id,
      q: query.q,
      notEnded: query.not_ended === "1",
      order: query.order,
      overlapsFrom: query.overlaps_from,
      overlapsTo: query.overlaps_to,
      publicOnly: true,
    });
    const going = await this.goingExtras(
      res.items.map((e) => e.id),
      c.get("user")?.user_id,
    );
    return c.json({
      success: true as const,
      data: {
        items: res.items.map((e) =>
          serialize(e, {
            category: e.category,
            village: e.village,
            goingCount: going.counts.get(e.id) ?? 0,
            viewerGoing: going.viewer.has(e.id),
          }),
        ),
        next_cursor: res.nextCursor,
      },
    });
  }

  async getBySlug(c: Context<{ Variables: AppVariables }>, slug: string) {
    const event = await this.getBySlugUc.execute(slug, true);
    const going = await this.goingExtras([event.id], c.get("user")?.user_id);
    return c.json({
      success: true as const,
      data: serialize(event, {
        category: event.category,
        village: event.village,
        goingCount: going.counts.get(event.id) ?? 0,
        viewerGoing: going.viewer.has(event.id),
      }),
    });
  }

  async listAdmin(
    c: Context<{ Variables: AppVariables }>,
    query: z.infer<typeof listEventsQuerySchema>,
  ) {
    const res = await this.listUc.execute({
      limit: query.limit,
      before: query.before,
      categoryId: query.category_id,
      villageId: query.village_id,
      regionId: query.region_id,
      placeId: query.place_id,
      q: query.q,
      status: query.status,
      notEnded: query.not_ended === "1",
      order: query.order,
      overlapsFrom: query.overlaps_from,
      overlapsTo: query.overlaps_to,
    });
    const going = await this.goingExtras(
      res.items.map((e) => e.id),
      c.get("user")?.user_id,
    );
    return c.json({
      success: true as const,
      data: {
        items: res.items.map((e) =>
          serialize(e, {
            category: e.category,
            village: e.village,
            goingCount: going.counts.get(e.id) ?? 0,
            viewerGoing: going.viewer.has(e.id),
          }),
        ),
        next_cursor: res.nextCursor,
      },
    });
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

  /** Batch count + viewer going - 0–2 query, tanpa N+1. */
  private async goingExtras(
    eventIds: string[],
    userId: string | undefined,
  ): Promise<{ counts: Map<string, number>; viewer: Set<string> }> {
    if (!this.goingRepo || eventIds.length === 0) {
      return { counts: new Map(), viewer: new Set() };
    }
    const counts = await this.goingRepo.countByEventIds(eventIds);
    const viewer = userId
      ? await this.goingRepo.viewerGoingByEventIds(userId, eventIds)
      : new Set<string>();
    return { counts, viewer };
  }

  // ---------------------------------------------------------------- komentar

  private get comments(): EventCommentControllerDeps {
    if (!this.commentDeps) throw new Error('comment deps not wired');
    return this.commentDeps;
  }

  async listComments(c: Context<{ Variables: AppVariables }>) {
    const { id } = c.req.valid('param' as never) as { id: string };
    const q = c.req.valid('query' as never) as { cursor?: string; limit: number };
    const page = await this.comments.listComments.execute(id, q.cursor, q.limit);
    return c.json({
      success: true as const,
      data: {
        items: page.items.map(toCommentWire),
        next_cursor: page.nextCursor,
        has_more: page.hasMore,
      },
    });
  }

  async createComment(c: Context<{ Variables: AppVariables }>) {
    const user = requireUser(c);
    const { id } = c.req.valid('param' as never) as { id: string };
    const body = c.req.valid('json' as never) as { body: string };
    const comment = await this.comments.createComment.execute({
      eventId: id,
      userId: user.user_id,
      body: body.body,
      requestId: c.get('requestId') ?? null,
    });
    return c.json({ success: true as const, data: toCommentWire(comment) }, 201);
  }

  async updateComment(c: Context<{ Variables: AppVariables }>) {
    const user = requireUser(c);
    const { id } = c.req.valid('param' as never) as { id: string };
    const body = c.req.valid('json' as never) as { body: string };
    const updated = await this.comments.updateComment.execute({
      commentId: id,
      userId: user.user_id,
      body: body.body,
      requestId: c.get('requestId') ?? null,
    });
    return c.json({ success: true as const, data: toCommentWire(updated) });
  }

  async deleteComment(c: Context<{ Variables: AppVariables }>) {
    const user = requireUser(c);
    const { id } = c.req.valid('param' as never) as { id: string };
    await this.comments.deleteComment.execute(id, user.user_id);
    return c.json({ success: true as const, data: null });
  }

  async takedownComment(c: Context<{ Variables: AppVariables }>) {
    const user = requireUser(c);
    const { id } = c.req.valid('param' as never) as { id: string };
    await this.comments.takedownComment.execute(id, user.user_id);
    return c.json({ success: true as const, data: null });
  }
}
