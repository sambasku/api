import type { Context } from 'hono';
import type { AppVariables } from '@/shared/types';
import type { z } from 'zod';
import { ANONIM_USER_ID } from '@/shared/constants/anonim';
import { BadRequestError, NotFoundError, UnauthorizedError } from '@/shared/errors/app-error';
import type { EntityCommentBody } from '@/shared/comment/entity-comment-body.schema';
import { entityCommentMediaWireFields } from '@/shared/comment/entity-comment-wire';
import { MAX_AUDIO_BYTES } from '@/modules/word/application/utils/validate-audio-file';
import type { CreateCuisineCommentAudioUseCase } from '../../application/use-cases/cuisine-comment-audio.use-case';
import { isVerifierRole } from '@/modules/word/application/utils/resolve-publication';
import type {
  Cuisine,
  CuisineComment,
  CuisineDetail,
  CuisineUsahaLink,
} from '../../domain/entities/culinary.entity';
import type {
  CreateCuisineCommentUseCase,
  DeleteCuisineCommentUseCase,
  ListCuisineCommentsUseCase,
  TakedownCuisineCommentUseCase,
  UpdateCuisineCommentUseCase,
} from '../../application/use-cases/cuisine-comment.use-cases';
import type {
  CulinaryRepository,
  CreateCuisineInput,
  UpdateCuisineInput,
} from '../../domain/repositories/culinary.repository';
import {
  AppendCuisineImagesUseCase,
  FindCulinaryDuplicatesUseCase,
  GetCuisineBySlugUseCase,
  ListCulinaryCategoriesUseCase,
  ListCuisinesUseCase,
  RestoreCulinaryUseCase,
  RestrictCulinaryUseCase,
  DeleteCulinaryUseCase,
  imagesToJson,
  sourcesToJson,
} from '../../application/use-cases/culinary.use-cases';
import type {
  createCuisineBodySchema,
  createLinkBodySchema,
  listCuisinesQuerySchema,
  updateCuisineBodySchema,
  updateLinkBodySchema,
} from './validators/culinary.validator';

type ListCuisinesQuery = z.infer<typeof listCuisinesQuerySchema>;

function requireUser(c: Context<{ Variables: AppVariables }>) {
  const user = c.get('user');
  if (!user) throw new UnauthorizedError();
  return user;
}

function toCuisineCommentWire(c: CuisineComment) {
  const deleted = c.authorDeletedAt !== null;
  return {
    id: c.id,
    cuisine_id: c.cuisineId,
    user: {
      user_id: c.userId,
      username: deleted ? null : c.username,
      display_name: deleted ? null : c.displayName,
      avatar_url: deleted ? null : c.avatarUrl,
      is_verifier: !deleted && isVerifierRole(c.userRole ?? ''),
    },
    ...entityCommentMediaWireFields({
      status: c.status,
      body: c.body,
      stickerId: c.stickerId,
      audio: c.audio,
      image: c.image,
    }),
    status: c.status,
    is_edited: c.isEdited,
    created_at: c.createdAt.toISOString(),
    updated_at: c.updatedAt?.toISOString() ?? null,
  };
}

export interface CuisineCommentControllerDeps {
  listComments: ListCuisineCommentsUseCase;
  createComment: CreateCuisineCommentUseCase;
  createCommentAudio: CreateCuisineCommentAudioUseCase;
  updateComment: UpdateCuisineCommentUseCase;
  deleteComment: DeleteCuisineCommentUseCase;
  takedownComment: TakedownCuisineCommentUseCase;
}

export function serializeLink(l: CuisineUsahaLink) {
  return {
    id: l.id,
    cuisine_id: l.cuisineId,
    usaha_id: l.usahaId,
    availability: l.availability,
    note: l.note,
    cuisine_name: l.cuisineName,
    cuisine_slug: l.cuisineSlug,
    usaha_name: l.usahaName,
    usaha_slug: l.usahaSlug,
  };
}

export function serializeCuisine(c: Cuisine | CuisineDetail) {
  const usahas = 'usahas' in c ? c.usahas : undefined;
  return {
    id: c.id,
    slug: c.slug,
    name: c.name,
    description: c.description,
    category_id: c.categoryId,
    category: c.category,
    origin_region: c.originRegion,
    images: c.images.map((img) => ({
      url: img.url,
      is_main: img.isMain,
      attribution: img.attribution,
    })),
    ingredients: c.ingredients,
    serving_suggestion: c.servingSuggestion,
    tags: c.tags,
    sources: c.sources.map((s) => ({
      name: s.name,
      type: s.type,
      address: s.address,
      license: s.license ?? null,
      license_url: s.licenseUrl ?? null,
    })),
    license: c.license,
    publish_status: c.publishStatus,
    restricted_reason: c.restrictedReason,
    restricted_at: c.restrictedAt ? c.restrictedAt.toISOString() : null,
    author_id: c.authorId,
    author: c.author
      ? {
          id: c.author.id,
          username: c.author.username,
          display_name: c.author.displayName,
        }
      : null,
    published_at: c.publishedAt ? c.publishedAt.toISOString() : null,
    created_at: c.createdAt.toISOString(),
    updated_at: c.updatedAt ? c.updatedAt.toISOString() : null,
    usahas: usahas?.map(serializeLink),
  };
}

type ListRelatedFn = {
  execute(
    kind: 'cuisine',
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

export class CulinaryController {
  constructor(
    private readonly repo: CulinaryRepository,
    private readonly listCuisinesUc: ListCuisinesUseCase,
    private readonly getCuisineUc: GetCuisineBySlugUseCase,
    private readonly listCategoriesUc: ListCulinaryCategoriesUseCase,
    private readonly cuisineDuplicatesUc: FindCulinaryDuplicatesUseCase,
    private readonly restrictCuisineUc: RestrictCulinaryUseCase,
    private readonly restoreCuisineUc: RestoreCulinaryUseCase,
    private readonly deleteCuisineUc: DeleteCulinaryUseCase,
    private readonly appendImagesUc: AppendCuisineImagesUseCase,
    private readonly listRelated?: ListRelatedFn,
    private readonly commentDeps?: CuisineCommentControllerDeps,
  ) {}

  private get cuisineComments(): CuisineCommentControllerDeps {
    if (!this.commentDeps) throw new Error('comment deps not wired');
    return this.commentDeps;
  }

  // ------------------------------------------------------------- publik --

  listCuisines(
    c: Context<{ Variables: AppVariables }>,
    query: ListCuisinesQuery,
  ) {
    return this.listCuisinesUc
      .execute({
        limit: query.limit,
        before: query.before,
        categoryId: query.category_id,
        q: query.q,
        publicOnly: true,
      })
      .then((res) =>
        c.json({
          success: true as const,
          data: {
            items: res.items.map(serializeCuisine),
            next_cursor: res.nextCursor,
          },
        }),
      );
  }

  async getCuisine(c: Context<{ Variables: AppVariables }>, slug: string) {
    const cuisine = await this.getCuisineUc.execute(slug, true);
    const related = this.listRelated
      ? await this.listRelated.execute('cuisine', cuisine.id)
      : [];
    return c.json({
      success: true as const,
      data: {
        ...serializeCuisine(cuisine as Cuisine),
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

  /** #281: tambah foto ke kuliner published (wajib login). */
  appendImages(
    c: Context<{ Variables: AppVariables }>,
    slug: string,
    urls: string[],
  ) {
    return this.appendImagesUc
      .execute(slug, c.get('user')?.user_id ?? ANONIM_USER_ID, urls)
      .then(() => c.json({ success: true as const, data: null }));
  }

  listCategories(c: Context<{ Variables: AppVariables }>, publicOnly: boolean) {
    return this.listCategoriesUc.execute(publicOnly).then((items) =>
      c.json({ success: true as const, data: { items } }),
    );
  }
  cuisineDuplicates(
    c: Context<{ Variables: AppVariables }>,
    q: string,
    excludeId?: string,
  ) {
    return this.cuisineDuplicatesUc
      .execute(q, excludeId)
      .then((items) => c.json({ success: true as const, data: { items } }));
  }

  // --------------------------------------------------------------- admin --

  listCuisinesAdmin(
    c: Context<{ Variables: AppVariables }>,
    query: ListCuisinesQuery,
  ) {
    return this.listCuisinesUc
      .execute({
        limit: query.limit,
        before: query.before,
        categoryId: query.category_id,
        q: query.q,
        status: query.status,
      })
      .then((res) =>
        c.json({
          success: true as const,
          data: {
            items: res.items.map(serializeCuisine),
            next_cursor: res.nextCursor,
          },
        }),
      );
  }

  restrictCuisine(c: Context<{ Variables: AppVariables }>, id: string, reason: string) {
    return this.restrictCuisineUc
      .execute(id, reason)
      .then((cuisine) => c.json({ success: true as const, data: serializeCuisine(cuisine as Cuisine) }));
  }

  restoreCuisine(c: Context<{ Variables: AppVariables }>, id: string) {
    return this.restoreCuisineUc
      .execute(id)
      .then((cuisine) => c.json({ success: true as const, data: serializeCuisine(cuisine as Cuisine) }));
  }

  deleteCuisine(c: Context<{ Variables: AppVariables }>, id: string) {
    return this.deleteCuisineUc
      .execute(id)
      .then(() => c.json({ success: true as const, data: null }));
  }

  // ------------------------------------------------ admin: tulis langsung --

  private cuisineInput(
    body: z.infer<typeof createCuisineBodySchema> | z.infer<typeof updateCuisineBodySchema>,
  ): Partial<CreateCuisineInput & UpdateCuisineInput> {
    return {
      ...(body.name !== undefined ? { name: body.name } : {}),
      ...(body.description !== undefined ? { description: body.description } : {}),
      ...(body.category_id !== undefined ? { categoryId: body.category_id } : {}),
      ...(body.origin_region !== undefined
        ? { originRegion: body.origin_region }
        : {}),
      ...(body.images !== undefined
        ? {
            imagesJson: imagesToJson(
              body.images.map((img) => ({
                url: img.url,
                isMain: img.is_main,
                attribution: img.attribution ?? undefined,
              })),
            )
          }
        : {}),
      ...(body.ingredients !== undefined
        ? { ingredientsJson: JSON.stringify(body.ingredients) }
        : {}),
      ...(body.serving_suggestion !== undefined
        ? { servingSuggestion: body.serving_suggestion }
        : {}),
      ...(body.tags !== undefined ? { tagsJson: JSON.stringify(body.tags) } : {}),
      ...(body.sources !== undefined ? { sourcesJson: sourcesToJson(body.sources) } : {}),
      ...(body.license !== undefined ? { license: body.license } : {}),
      ...(body.publish_status !== undefined
        ? { publishStatus: body.publish_status }
        : {}),
    };
  }

  createCuisine(
    c: Context<{ Variables: AppVariables }>,
    body: z.infer<typeof createCuisineBodySchema>,
  ) {
    const input = {
      ...this.cuisineInput(body),
      slug: body.slug,
      name: body.name,
      publishStatus: 'published',
      authorId: c.get('user')?.user_id ?? null,
    } as CreateCuisineInput;
    return this.repo
      .createCuisine(input)
      .then((cuisine) => c.json({ success: true as const, data: serializeCuisine(cuisine as Cuisine) }));
  }

  updateCuisine(
    c: Context<{ Variables: AppVariables }>,
    id: string,
    body: z.infer<typeof updateCuisineBodySchema>,
  ) {
    const input = { id, ...this.cuisineInput(body) } as UpdateCuisineInput;
    return this.repo.updateCuisine(input).then((cuisine) => {
      if (!cuisine) {
        throw new NotFoundError('CUISINE_NOT_FOUND', 'Kuliner tidak ditemukan');
      }
      return c.json({ success: true as const, data: serializeCuisine(cuisine) });
    });
  }

  createLink(
    c: Context<{ Variables: AppVariables }>,
    body: z.infer<typeof createLinkBodySchema>,
  ) {
    return this.repo
      .createLink({
        cuisineId: body.cuisine_id,
        usahaId: body.usaha_id,
        availability: body.availability,
        note: body.note ?? null,
        publishStatus: body.publish_status ?? 'published',
        authorId: c.get('user')?.user_id ?? null,
      })
      .then((link) => c.json({ success: true as const, data: serializeLink(link) }));
  }

  updateLink(
    c: Context<{ Variables: AppVariables }>,
    id: string,
    body: z.infer<typeof updateLinkBodySchema>,
  ) {
    return this.repo
      .updateLink({
        id,
        availability: body.availability,
        note: body.note,
        publishStatus: body.publish_status,
      })
      .then((link) => {
        if (!link) {
          throw new NotFoundError('LINK_NOT_FOUND', 'Relasi tidak ditemukan');
        }
        return c.json({ success: true as const, data: serializeLink(link) });
      });
  }

  deleteLink(c: Context<{ Variables: AppVariables }>, id: string) {
    return this.repo.softDeleteLink(id).then((ok) => {
      if (!ok) {
        throw new NotFoundError('LINK_NOT_FOUND', 'Relasi tidak ditemukan');
      }
      return c.json({ success: true as const, data: null });
    });
  }

  async listCuisineComments(c: Context<{ Variables: AppVariables }>) {
    const { id } = c.req.valid('param' as never) as { id: string };
    const q = c.req.valid('query' as never) as { cursor?: string; limit: number };
    const page = await this.cuisineComments.listComments.execute(id, q.cursor, q.limit);
    return c.json({
      success: true as const,
      data: {
        items: page.items.map(toCuisineCommentWire),
        next_cursor: page.nextCursor,
        has_more: page.hasMore,
      },
    });
  }

  async createCuisineComment(c: Context<{ Variables: AppVariables }>) {
    const user = requireUser(c);
    const { id } = c.req.valid('param' as never) as { id: string };
    const body = c.req.valid('json' as never) as EntityCommentBody;
    const comment = await this.cuisineComments.createComment.execute({
      cuisineId: id,
      userId: user.user_id,
      body: body.body ?? '',
      stickerId: body.sticker_id ?? null,
      image: body.image
        ? { url: body.image.url, providerFileId: body.image.provider_file_id }
        : null,
      requestId: c.get('requestId') ?? null,
    });
    return c.json({ success: true as const, data: toCuisineCommentWire(comment) }, 201);
  }

  async createCuisineCommentAudio(c: Context<{ Variables: AppVariables }>) {
    const user = requireUser(c);
    const { id } = c.req.valid('param' as never) as { id: string };
    const contentLength = Number(c.req.header('content-length') ?? 0);
    if (contentLength > MAX_AUDIO_BYTES + 1024 * 1024) {
      throw new BadRequestError('AUDIO_TOO_LARGE', 'File audio terlalu besar (maks 5 MB)', [
        { field: 'audio', message: 'Ukuran maksimal 5 MB' },
      ]);
    }
    const body = await c.req.parseBody({ all: true });
    const audioPart = body['audio'];
    if (!audioPart || typeof audioPart === 'string') {
      throw new BadRequestError('VALIDATION_ERROR', 'File audio wajib diunggah', [
        { field: 'audio', message: 'Field multipart `audio` wajib berisi file' },
      ]);
    }
    const file = audioPart as File;
    const bytes = new Uint8Array(await file.arrayBuffer());
    const comment = await this.cuisineComments.createCommentAudio.execute({
      cuisineId: id,
      userId: user.user_id,
      bytes,
      mimeType: file.type || null,
      filename: file.name || null,
      body: typeof body['body'] === 'string' ? body['body'] : null,
      durationMs: body['duration_ms'],
      requestId: c.get('requestId') ?? null,
    });
    return c.json({ success: true as const, data: toCuisineCommentWire(comment) }, 201);
  }

  async updateCuisineComment(c: Context<{ Variables: AppVariables }>) {
    const user = requireUser(c);
    const { id } = c.req.valid('param' as never) as { id: string };
    const body = c.req.valid('json' as never) as { body: string };
    const updated = await this.cuisineComments.updateComment.execute({
      commentId: id,
      userId: user.user_id,
      body: body.body,
      requestId: c.get('requestId') ?? null,
    });
    return c.json({ success: true as const, data: toCuisineCommentWire(updated) });
  }

  async deleteCuisineComment(c: Context<{ Variables: AppVariables }>) {
    const user = requireUser(c);
    const { id } = c.req.valid('param' as never) as { id: string };
    await this.cuisineComments.deleteComment.execute(id, user.user_id);
    return c.json({ success: true as const, data: null });
  }

  async takedownCuisineComment(c: Context<{ Variables: AppVariables }>) {
    const user = requireUser(c);
    const { id } = c.req.valid('param' as never) as { id: string };
    await this.cuisineComments.takedownComment.execute(id, user.user_id);
    return c.json({ success: true as const, data: null });
  }
}