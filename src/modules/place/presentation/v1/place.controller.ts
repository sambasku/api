import type { Context } from "hono";
import { ANONIM_USER_ID } from "@/shared/constants/anonim";
import { UnauthorizedError } from "@/shared/errors/app-error";
import type { AppVariables } from "@/shared/types";
import { isVerifierRole } from "@/modules/word/application/utils/resolve-publication";
import { clientIpKey, normalizedDeviceId } from "@/shared/middlewares/rate-limit.middleware";
import type {
  Place,
  PlaceComment,
  PlaceImage,
  PlaceRelatedCard,
} from "../../domain/entities/place.entity";
import type {
  CreatePlaceCommentUseCase,
  DeletePlaceCommentUseCase,
  ListPlaceCommentsUseCase,
  TakedownPlaceCommentUseCase,
  UpdatePlaceCommentUseCase,
} from "../../application/use-cases/place-comment.use-cases";
import type {
  AppendPlaceImagesUseCase,
  CreatePlaceUseCase,
  DeletePlaceUseCase,
  GetPlaceBySlugUseCase,
  GetPlaceViewReportUseCase,
  HidePlaceImageUseCase,
  ListPlaceImagesUseCase,
  ListPlacesUseCase,
  ListPlaceViewsUseCase,
  RecordPlaceViewUseCase,
  UpdatePlaceUseCase,
} from "../../application/use-cases/place.use-cases";
import type { z } from "zod";
import type { PlaceVisitRepository } from "@/modules/place-visit/domain/repositories/place-visit.repository";
import type {
  createPlaceBodySchema,
  listPlacesQuerySchema,
  updatePlaceBodySchema,
} from "./validators/place.validator";

/**
 * Identitas pembaca untuk dedupe view harian: user login > device id > IP.
 * Prefiks mencegah tabrakan antar ruang nama (user vs device vs ip).
 */
export function requireUser(c: Context<{ Variables: AppVariables }>) {
  const user = c.get("user");
  if (!user) throw new UnauthorizedError();
  return user;
}

function toCommentWire(c: PlaceComment) {
  const deleted = c.authorDeletedAt !== null;
  return {
    id: c.id,
    place_id: c.placeId,
    user: {
      user_id: c.userId,
      username: deleted ? null : c.username,
      display_name: deleted ? null : c.displayName,
      avatar_url: deleted ? null : c.avatarUrl,
      is_verifier: !deleted && isVerifierRole(c.userRole ?? ""),
    },
    body: c.body,
    status: c.status,
    is_edited: c.isEdited,
    created_at: c.createdAt.toISOString(),
    updated_at: c.updatedAt?.toISOString() ?? null,
  };
}

export interface PlaceCommentControllerDeps {
  listComments: ListPlaceCommentsUseCase;
  createComment: CreatePlaceCommentUseCase;
  updateComment: UpdatePlaceCommentUseCase;
  deleteComment: DeletePlaceCommentUseCase;
  takedownComment: TakedownPlaceCommentUseCase;
}

function viewerKey(c: Context<{ Variables: AppVariables }>): string {
  const userId = c.get("user")?.user_id;
  if (userId) return `u:${userId}`;
  const deviceId = normalizedDeviceId(c);
  if (deviceId) return `d:${deviceId}`;
  return `ip:${clientIpKey(c)}`;
}

function serialize(
  p: Place,
  extra?: {
    imageCount?: number;
    relatedCards?: PlaceRelatedCard[];
    visitCount?: number;
    viewerVisited?: boolean;
  },
) {
  const related = (
    extra?.relatedCards ??
    p.related.map((r) => ({
      kind: r.kind,
      slug: r.slug,
      name: null,
      category: null,
      type: null,
      coverUrl: null,
    }))
  ).map((r) => ({
    kind: r.kind,
    slug: r.slug,
    name: r.name,
    category: r.category,
    type: r.type,
    cover_url: r.coverUrl,
  }));
  return {
    id: p.id,
    slug: p.slug,
    name: p.name,
    category: p.category,
    type: p.type,
    lat: p.lat,
    lng: p.lng,
    maps_url: p.mapsUrl,
    short_description: p.shortDescription,
    region_id: p.regionId,
    village_id: p.villageId,
    hours: p.hours,
    contact: p.contact,
    author_id: p.authorId,
    author: p.author
      ? {
          id: p.author.id,
          username: p.author.username,
          display_name: p.author.displayName,
        }
      : null,
    related,
    image_count: extra?.imageCount ?? p.images.length,
    sources: p.sources.map((s) => ({
      name: s.name,
      type: s.type,
      address: s.address,
      license: s.license ?? null,
      license_url: s.licenseUrl ?? null,
    })),
    images: p.images.map((img) => ({
      id: img.id,
      url: img.url,
      is_main: img.isMain,
      sort_order: img.sortOrder,
      attribution: img.attribution
        ? {
            name: img.attribution.name,
            provider: img.attribution.provider,
            url: img.attribution.url ?? null,
            license: img.attribution.license ?? null,
            license_url: img.attribution.licenseUrl ?? null,
            source: img.attribution.source ?? null,
            authorId: img.attribution.authorId ?? null,
          }
        : null,
    })),
    status: p.status,
    visit_count: extra?.visitCount ?? 0,
    viewer_visited: extra?.viewerVisited ?? false,
    created_at: Math.floor(p.createdAt.getTime() / 1000),
    updated_at: p.updatedAt ? Math.floor(p.updatedAt.getTime() / 1000) : null,
  };
}

function serializeImage(img: PlaceImage) {
  return {
    id: img.id,
    url: img.url,
    is_main: img.isMain,
    sort_order: img.sortOrder,
    attribution: img.attribution
      ? {
          name: img.attribution.name,
          provider: img.attribution.provider,
          url: img.attribution.url ?? null,
          license: img.attribution.license ?? null,
          license_url: img.attribution.licenseUrl ?? null,
          source: img.attribution.source ?? null,
          authorId: img.attribution.authorId ?? null,
        }
      : null,
  };
}

function mapImages(images?: z.infer<typeof createPlaceBodySchema>["images"]) {
  return images?.map((img) => ({
    url: img.url,
    isMain: img.is_main,
    sortOrder: img.sort_order,
    attribution: img.attribution
      ? {
          name: img.attribution.name,
          provider: img.attribution.provider,
          url: img.attribution.url,
          license: img.attribution.license,
          licenseUrl: img.attribution.license_url,
          source: img.attribution.source,
          authorId: img.attribution.authorId,
        }
      : null,
  }));
}

function mapSources(
  sources?: z.infer<typeof createPlaceBodySchema>["sources"],
) {
  return sources?.map((s) => ({
    name: s.name,
    type: s.type,
    address: s.address,
    license: s.license,
    licenseUrl: s.license_url,
  }));
}

type ListRelatedFn = {
  execute(
    kind: 'place',
    id: string,
  ): Promise<
    Array<{
      kind: string;
      id: string;
      slug: string | null;
      title: string;
      coverUrl: string | null;
    }>
  >;
};

type ReplaceRelatedFn = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  execute(input: any): Promise<unknown>;
};

export class PlaceController {
  constructor(
    private readonly createUc: CreatePlaceUseCase,
    private readonly updateUc: UpdatePlaceUseCase,
    private readonly deleteUc: DeletePlaceUseCase,
    private readonly listUc: ListPlacesUseCase,
    private readonly getBySlugUc: GetPlaceBySlugUseCase,
    private readonly listImagesUc: ListPlaceImagesUseCase,
    private readonly appendImagesUc: AppendPlaceImagesUseCase,
    private readonly recordViewUc: RecordPlaceViewUseCase,
    private readonly listViewsUc: ListPlaceViewsUseCase,
    private readonly viewReportUc: GetPlaceViewReportUseCase,
    private readonly hideImageUc: HidePlaceImageUseCase,
    private readonly listRelated?: ListRelatedFn,
    private readonly replaceRelated?: ReplaceRelatedFn,
    private readonly visitRepo?: PlaceVisitRepository,
    private readonly commentDeps?: PlaceCommentControllerDeps,
  ) {}

  private get comments(): PlaceCommentControllerDeps {
    if (!this.commentDeps) throw new Error("comment deps not wired");
    return this.commentDeps;
  }

  /** Batch count + viewer visited - 0-2 query, tanpa N+1. */
  private async visitExtras(
    placeIds: string[],
    userId: string | undefined,
  ): Promise<{ counts: Map<string, number>; viewer: Set<string> }> {
    if (!this.visitRepo || placeIds.length === 0) {
      return { counts: new Map(), viewer: new Set() };
    }
    const counts = await this.visitRepo.countByPlaceIds(placeIds);
    const viewer = userId
      ? await this.visitRepo.viewerVisitedByPlaceIds(userId, placeIds)
      : new Set<string>();
    return { counts, viewer };
  }

  async listPublic(
    c: Context<{ Variables: AppVariables }>,
    query: z.infer<typeof listPlacesQuerySchema>,
  ) {
    const r = await this.listUc.execute({
      limit: query.limit,
      before: query.before,
      category: query.category,
      type: query.type,
      regionId: query.region_id,
      villageId: query.village_id,
      villageUnset: query.village_unset === "1",
      q: query.q,
      publicOnly: true,
    });
    const visits = await this.visitExtras(
      r.items.map((item) => item.id),
      c.get("user")?.user_id,
    );
    return c.json({
      success: true as const,
      data: {
        items: r.items.map((item) =>
          serialize(item, {
            visitCount: visits.counts.get(item.id) ?? 0,
            viewerVisited: visits.viewer.has(item.id),
          }),
        ),
        next_cursor: r.nextCursor,
      },
    });
  }

  async getBySlug(c: Context<{ Variables: AppVariables }>, slug: string) {
    const p = await this.getBySlugUc.execute(slug, true);
    const visits = await this.visitExtras([p.id], c.get("user")?.user_id);
    const fromLinks = this.listRelated
      ? await this.listRelated.execute('place', p.id)
      : [];
    // Legacy relatedCards tetap place|usaha; content_links penuh di `content_related`
    // (dan menimpa `related` bila ada edge supaya klien baru dapat id/title).
    const base = serialize(p, {
      imageCount: p.imageCount,
      relatedCards: p.relatedCards,
      visitCount: visits.counts.get(p.id) ?? 0,
      viewerVisited: visits.viewer.has(p.id),
    });
    if (fromLinks.length === 0) {
      return c.json({ success: true as const, data: base });
    }
    // Jangan timpa `related` legacy (place|usaha "dekat sini");
    // kartu lintas fitur di field terpisah.
    return c.json({
      success: true as const,
      data: {
        ...base,
        content_related: fromLinks.map((r) => ({
          kind: r.kind,
          id: r.id,
          slug: r.slug,
          title: r.title,
          cover_url: r.coverUrl,
        })),
      },
    });
  }

  listAdmin(
    c: Context<{ Variables: AppVariables }>,
    query: z.infer<typeof listPlacesQuerySchema>,
  ) {
    return this.listUc
      .execute({
        limit: query.limit,
        before: query.before,
        category: query.category,
        type: query.type,
        regionId: query.region_id,
        villageId: query.village_id,
        villageUnset: query.village_unset === "1",
        q: query.q,
        status: query.status,
        publicOnly: false,
      })
      .then((r) =>
        c.json({
          success: true as const,
          data: {
            items: r.items.map((item) => serialize(item)),
            next_cursor: r.nextCursor,
          },
        }),
      );
  }

  async create(
    c: Context<{ Variables: AppVariables }>,
    body: z.infer<typeof createPlaceBodySchema>,
  ) {
    const p = await this.createUc.execute({
      id: body.id,
      slug: body.slug,
      name: body.name,
      category: body.category,
      type: body.type ?? null,
      lat: body.lat ?? null,
      lng: body.lng ?? null,
      mapsUrl: body.maps_url ?? null,
      shortDescription: body.short_description ?? "",
      regionId: body.region_id ?? null,
      villageId: body.village_id ?? null,
      hours: body.hours ?? null,
      contact: body.contact ?? null,
      authorId: body.author_id ?? null,
      sources: mapSources(body.sources),
      related: body.related,
      images: mapImages(body.images),
      status: body.status,
    });
    if (body.related && this.replaceRelated) {
      await this.replaceRelated.execute({
        anchor: { kind: 'place', id: p.id },
        related: body.related.map((r) => ({
          kind: r.kind,
          slug: r.slug,
        })),
        createdBy: c.get('user')?.user_id ?? null,
      });
    }
    return c.json({ success: true as const, data: serialize(p) });
  }

  async update(
    c: Context<{ Variables: AppVariables }>,
    id: string,
    body: z.infer<typeof updatePlaceBodySchema>,
  ) {
    const p = await this.updateUc.execute({
      id,
      slug: body.slug,
      name: body.name,
      category: body.category,
      type: body.type,
      lat: body.lat,
      lng: body.lng,
      mapsUrl: body.maps_url,
      shortDescription: body.short_description,
      regionId: body.region_id,
      villageId: body.village_id,
      hours: body.hours,
      contact: body.contact,
      authorId: body.author_id,
      sources: mapSources(body.sources),
      related: body.related,
      images: mapImages(body.images),
      status: body.status,
    });
    if (body.related && this.replaceRelated) {
      await this.replaceRelated.execute({
        anchor: { kind: 'place', id: p.id },
        related: body.related.map((r) => ({
          kind: r.kind,
          slug: r.slug,
        })),
        createdBy: c.get('user')?.user_id ?? null,
      });
    }
    return c.json({ success: true as const, data: serialize(p) });
  }

  listImages(
    c: Context<{ Variables: AppVariables }>,
    slug: string,
    offset: number,
  ) {
    return this.listImagesUc.execute(slug, offset).then((page) =>
      c.json({
        success: true as const,
        data: {
          items: page.items.map(serializeImage),
          total: page.total,
          next_offset: page.nextOffset,
        },
      }),
    );
  }

  appendImages(
    c: Context<{ Variables: AppVariables }>,
    slug: string,
    urls: string[],
  ) {
    return this.appendImagesUc
      .execute(slug, c.get("user")?.user_id ?? ANONIM_USER_ID, urls)
      .then(() => c.json({ success: true as const, data: null }));
  }

  /** #187: takedown foto (admin). Foto disembunyikan + event feed ikut. */
  hideImage(
    c: Context<{ Variables: AppVariables }>,
    placeId: string,
    imageId: string,
  ) {
    return this.hideImageUc
      .execute(placeId, imageId)
      .then(() => c.json({ success: true as const, data: null }));
  }

  remove(c: Context<{ Variables: AppVariables }>, id: string) {
    return this.deleteUc
      .execute(id)
      .then(() => c.json({ success: true as const, data: null }));
  }

  /**
   * Publik: catat view detail. Slug tak dikenal / draft = silent no-op.
   * 1 pembaca = 1 view per hari (dedupe server via viewerKey).
   */
  recordView(c: Context<{ Variables: AppVariables }>, slug: string) {
    return this.recordViewUc
      .execute(slug, viewerKey(c))
      .then(() => c.json({ success: true as const, data: null }));
  }

  /** Admin: total view per place sejak `days` hari (null = semua waktu). */
  listViews(c: Context<{ Variables: AppVariables }>, days: number | null) {
    return this.listViewsUc.execute(days).then((map) =>
      c.json({
        success: true as const,
        data: {
          items: [...map].map(([place_id, views]) => ({ place_id, views })),
        },
      }),
    );
  }

  /** Admin: laporan tren harian + ranking per place untuk halaman analitik. */
  listViewsDaily(c: Context<{ Variables: AppVariables }>, days: number) {
    return this.viewReportUc
      .execute(days)
      .then((report) => c.json({ success: true as const, data: report }));
  }

  async listComments(c: Context<{ Variables: AppVariables }>) {
    const { id } = c.req.valid("param" as never) as { id: string };
    const q = c.req.valid("query" as never) as { cursor?: string; limit: number };
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
    const { id } = c.req.valid("param" as never) as { id: string };
    const body = c.req.valid("json" as never) as { body: string };
    const comment = await this.comments.createComment.execute({
      placeId: id,
      userId: user.user_id,
      body: body.body,
      requestId: c.get("requestId") ?? null,
    });
    return c.json({ success: true as const, data: toCommentWire(comment) }, 201);
  }

  async updateComment(c: Context<{ Variables: AppVariables }>) {
    const user = requireUser(c);
    const { id } = c.req.valid("param" as never) as { id: string };
    const body = c.req.valid("json" as never) as { body: string };
    const updated = await this.comments.updateComment.execute({
      commentId: id,
      userId: user.user_id,
      body: body.body,
      requestId: c.get("requestId") ?? null,
    });
    return c.json({ success: true as const, data: toCommentWire(updated) });
  }

  async deleteComment(c: Context<{ Variables: AppVariables }>) {
    const user = requireUser(c);
    const { id } = c.req.valid("param" as never) as { id: string };
    await this.comments.deleteComment.execute(id, user.user_id);
    return c.json({ success: true as const, data: null });
  }

  async takedownComment(c: Context<{ Variables: AppVariables }>) {
    const user = requireUser(c);
    const { id } = c.req.valid("param" as never) as { id: string };
    await this.comments.takedownComment.execute(id, user.user_id);
    return c.json({ success: true as const, data: null });
  }
}
