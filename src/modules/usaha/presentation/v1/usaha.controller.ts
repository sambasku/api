import type { Context } from 'hono';
import type { AppVariables } from '@/shared/types';
import type { z } from 'zod';
import { ANONIM_USER_ID } from '@/shared/constants/anonim';
import { UnauthorizedError } from '@/shared/errors/app-error';
import { isVerifierRole } from '@/modules/word/application/utils/resolve-publication';
import type {
  UsahaComment,
  UsahaDetail,
  UsahaListItem,
} from '../../domain/entities/usaha.entity';
import type {
  CreateUsahaCommentUseCase,
  DeleteUsahaCommentUseCase,
  ListUsahaCommentsUseCase,
  TakedownUsahaCommentUseCase,
  UpdateUsahaCommentUseCase,
} from '../../application/use-cases/usaha-comment.use-cases';
import type {
  AppendUsahaImagesUseCase,
  CreateUsahaUseCase,
  DeleteUsahaUseCase,
  FindUsahaDuplicatesUseCase,
  GetUsahaBySlugUseCase,
  HideUsahaImageUseCase,
  ListUsahaCategoriesUseCase,
  ListUsahaImagesUseCase,
  ListUsahasUseCase,
  RestoreUsahaUseCase,
  RestrictUsahaUseCase,
  UpdateUsahaUseCase,
} from '../../application/use-cases/usaha.use-cases';
import type { UsahaVisitRepository } from '@/modules/usaha-visit/domain/repositories/usaha-visit.repository';
import type {
  createUsahaBodySchema,
  listUsahasQuerySchema,
  updateUsahaBodySchema,
} from './validators/usaha.validator';

type CreateBody = z.infer<typeof createUsahaBodySchema>;
type UpdateBody = z.infer<typeof updateUsahaBodySchema>;

function requireUser(c: Context<{ Variables: AppVariables }>) {
  const user = c.get('user');
  if (!user) throw new UnauthorizedError();
  return user;
}

function toCommentWire(c: UsahaComment) {
  const deleted = c.authorDeletedAt !== null;
  return {
    id: c.id,
    usaha_id: c.usahaId,
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

export interface UsahaCommentControllerDeps {
  listComments: ListUsahaCommentsUseCase;
  createComment: CreateUsahaCommentUseCase;
  updateComment: UpdateUsahaCommentUseCase;
  deleteComment: DeleteUsahaCommentUseCase;
  takedownComment: TakedownUsahaCommentUseCase;
}

function serialize(
  u: UsahaListItem | UsahaDetail,
  extra?: { visitCount?: number; viewerVisited?: boolean },
) {
  const items = 'items' in u ? u.items : undefined;
  return {
    id: u.id,
    slug: u.slug,
    name: u.name,
    description: u.description,
    category_id: u.categoryId,
    category: u.category,
    kind: u.kind,
    region_id: u.regionId,
    region: u.region
      ? { id: u.region.id, name: u.region.name, slug: u.region.slug }
      : null,
    village_id: u.villageId,
    village: u.village,
    address_text: u.addressText,
    lat: u.lat,
    lng: u.lng,
    maps_url: u.mapsUrl,
    phone: u.phone,
    whatsapp: u.whatsapp,
    website: u.website,
    social_url: u.socialUrl,
    cover_url: u.coverUrl,
    publish_status: u.publishStatus,
    operational_status: u.operationalStatus,
    restricted_reason: u.restrictedReason,
    restricted_at: u.restrictedAt ? u.restrictedAt.toISOString() : null,
    manager_id: u.managerId,
    author_id: u.authorId,
    author: u.author
      ? {
          id: u.author.id,
          username: u.author.username,
          display_name: u.author.displayName,
        }
      : null,
    manager: u.manager
      ? {
          id: u.manager.id,
          username: u.manager.username,
          display_name: u.manager.displayName,
        }
      : null,
    published_at: u.publishedAt ? u.publishedAt.toISOString() : null,
    visit_count: extra?.visitCount ?? 0,
    viewer_visited: extra?.viewerVisited ?? false,
    created_at: u.createdAt.toISOString(),
    updated_at: u.updatedAt ? u.updatedAt.toISOString() : null,
    items: items?.map((it) => ({
      id: it.id,
      name: it.name,
      description: it.description,
      price_text: it.priceText,
      image_url: it.imageUrl,
      sort_order: it.sortOrder,
    })),
    images:
      'images' in u && u.images
        ? u.images.map((img) => ({
            id: img.id,
            url: img.url,
            is_main: img.isMain,
            sort_order: img.sortOrder,
            attribution: img.attribution
              ? {
                  name: img.attribution.name,
                  provider: img.attribution.provider,
                  author_id: img.attribution.authorId ?? null,
                  username: img.attribution.username ?? null,
                }
              : null,
          }))
        : undefined,
  };
}

type ListRelatedFn = {
  execute(
    kind: 'usaha',
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

export class UsahaController {
  constructor(
    private readonly createUc: CreateUsahaUseCase,
    private readonly updateUc: UpdateUsahaUseCase,
    private readonly deleteUc: DeleteUsahaUseCase,
    private readonly listUc: ListUsahasUseCase,
    private readonly getBySlugUc: GetUsahaBySlugUseCase,
    private readonly restrictUc: RestrictUsahaUseCase,
    private readonly restoreUc: RestoreUsahaUseCase,
    private readonly listCategoriesUc: ListUsahaCategoriesUseCase,
    private readonly duplicatesUc: FindUsahaDuplicatesUseCase,
    private readonly listImagesUc: ListUsahaImagesUseCase,
    private readonly appendImagesUc: AppendUsahaImagesUseCase,
    private readonly hideImageUc: HideUsahaImageUseCase,
    private readonly listRelated?: ListRelatedFn,
    private readonly visitRepo?: UsahaVisitRepository,
    private readonly commentDeps?: UsahaCommentControllerDeps,
  ) {}

  private get comments(): UsahaCommentControllerDeps {
    if (!this.commentDeps) throw new Error('comment deps not wired');
    return this.commentDeps;
  }

  private async visitExtras(
    usahaIds: string[],
    userId: string | undefined,
  ): Promise<{ counts: Map<string, number>; viewer: Set<string> }> {
    if (!this.visitRepo || usahaIds.length === 0) {
      return { counts: new Map(), viewer: new Set() };
    }
    const counts = await this.visitRepo.countByUsahaIds(usahaIds);
    const viewer = userId
      ? await this.visitRepo.viewerVisitedByUsahaIds(userId, usahaIds)
      : new Set<string>();
    return { counts, viewer };
  }

  listCategories(c: Context<{ Variables: AppVariables }>, publicOnly: boolean) {
    return this.listCategoriesUc.execute(publicOnly).then((items) =>
      c.json({ success: true as const, data: { items } }),
    );
  }

  async listPublic(
    c: Context<{ Variables: AppVariables }>,
    query: z.infer<typeof listUsahasQuerySchema>,
  ) {
    const res = await this.listUc.execute({
      limit: query.limit,
      before: query.before,
      categoryId: query.category_id,
      regionId: query.region_id,
      villageId: query.village_id,
      kind: query.kind,
      operationalStatus: query.operational_status,
      q: query.q,
      publicOnly: true,
    });
    const visits = await this.visitExtras(
      res.items.map((u) => u.id),
      c.get('user')?.user_id,
    );
    return c.json({
      success: true as const,
      data: {
        items: res.items.map((u) =>
          serialize(u, {
            visitCount: visits.counts.get(u.id) ?? 0,
            viewerVisited: visits.viewer.has(u.id),
          }),
        ),
        next_cursor: res.nextCursor,
      },
    });
  }

  async getBySlug(c: Context<{ Variables: AppVariables }>, slug: string) {
    const usaha = await this.getBySlugUc.execute(slug, true);
    const visits = await this.visitExtras([usaha.id], c.get('user')?.user_id);
    const related = this.listRelated
      ? await this.listRelated.execute('usaha', usaha.id)
      : [];
    return c.json({
      success: true as const,
      data: {
        ...serialize(usaha, {
          visitCount: visits.counts.get(usaha.id) ?? 0,
          viewerVisited: visits.viewer.has(usaha.id),
        }),
        related: related.map((r) => ({
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
    query: z.infer<typeof listUsahasQuerySchema>,
  ) {
    return this.listUc
      .execute({
        limit: query.limit,
        before: query.before,
        categoryId: query.category_id,
        regionId: query.region_id,
        villageId: query.village_id,
        kind: query.kind,
        operationalStatus: query.operational_status,
        q: query.q,
        status: query.status,
      })
      .then((res) =>
        c.json({
          success: true as const,
          data: {
            items: res.items.map((u) => serialize(u)),
            next_cursor: res.nextCursor,
          },
        }),
      );
  }

  create(c: Context<{ Variables: AppVariables }>, body: CreateBody) {
    return this.createUc
      .execute({
        id: body.id,
        slug: body.slug,
        name: body.name,
        description: body.description,
        categoryId: body.category_id,
        kind: body.kind,
        regionId: body.region_id,
        villageId: body.village_id,
        addressText: body.address_text,
        lat: body.lat,
        lng: body.lng,
        mapsUrl: body.maps_url,
        phone: body.phone,
        whatsapp: body.whatsapp,
        website: body.website,
        socialUrl: body.social_url,
        coverUrl: body.cover_url,
        publishStatus: body.publish_status,
        operationalStatus: body.operational_status,
        authorId: c.get('user')?.user_id ?? null,
      })
      .then((usaha) => c.json({ success: true as const, data: serialize(usaha) }));
  }

  update(c: Context<{ Variables: AppVariables }>, id: string, body: UpdateBody) {
    return this.updateUc
      .execute({
        id,
        slug: body.slug,
        name: body.name,
        description: body.description,
        categoryId: body.category_id,
        kind: body.kind,
        regionId: body.region_id,
        villageId: body.village_id,
        addressText: body.address_text,
        lat: body.lat,
        lng: body.lng,
        mapsUrl: body.maps_url,
        phone: body.phone,
        whatsapp: body.whatsapp,
        website: body.website,
        socialUrl: body.social_url,
        coverUrl: body.cover_url,
        publishStatus: body.publish_status,
        operationalStatus: body.operational_status,
      })
      .then((usaha) => c.json({ success: true as const, data: serialize(usaha) }));
  }

  remove(c: Context<{ Variables: AppVariables }>, id: string) {
    return this.deleteUc
      .execute(id)
      .then(() => c.json({ success: true as const, data: null }));
  }

  restrict(c: Context<{ Variables: AppVariables }>, id: string, reason: string) {
    return this.restrictUc
      .execute(id, reason)
      .then((usaha) => c.json({ success: true as const, data: serialize(usaha) }));
  }

  restore(c: Context<{ Variables: AppVariables }>, id: string) {
    return this.restoreUc
      .execute(id)
      .then((usaha) => c.json({ success: true as const, data: serialize(usaha) }));
  }

  duplicates(c: Context<{ Variables: AppVariables }>, id: string) {
    return this.duplicatesUc
      .execute(id)
      .then((items) => c.json({ success: true as const, data: { items } }));
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
          items: page.items.map((img) => ({
            id: img.id,
            url: img.url,
            is_main: img.isMain,
            sort_order: img.sortOrder,
            attribution: img.attribution
              ? {
                  name: img.attribution.name,
                  provider: img.attribution.provider,
                  author_id: img.attribution.authorId ?? null,
                  username: img.attribution.username ?? null,
                }
              : null,
          })),
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
      .execute(slug, c.get('user')?.user_id ?? ANONIM_USER_ID, urls)
      .then(() => c.json({ success: true as const, data: null }));
  }

  hideImage(
    c: Context<{ Variables: AppVariables }>,
    usahaId: string,
    imageId: string,
  ) {
    return this.hideImageUc
      .execute(usahaId, imageId)
      .then(() => c.json({ success: true as const, data: null }));
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
      usahaId: id,
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
