import { and, asc, desc, eq, getTableColumns, inArray, isNull, lt, ne, or, sql } from 'drizzle-orm';
import type { AppDatabase } from '@/shared/database/drizzle/client';
import { cuisines } from '@/shared/database/drizzle/schema/cuisines.schema';
import {
  cuisineComments,
  cuisineCommentRevisions,
} from '@/shared/database/drizzle/schema/cuisine-comments.schema';
import { users } from '@/shared/database/drizzle/schema/users.schema';
import { highestUserRoleSql } from '@/shared/database/highest-user-role-sql';
import { culinaryCategories } from '@/shared/database/drizzle/schema/culinary-categories.schema';
import { usahas } from '@/shared/database/drizzle/schema/usahas.schema';
import { cuisineUsahas } from '@/shared/database/drizzle/schema/cuisine-usahas.schema';
import { ilikeCompat } from '@/shared/database/drizzle/ilike-compat';
import { generateId } from '@/shared/utils/ulid';
import { ConflictError } from '@/shared/errors/app-error';
import { resolvePublicAuthor } from '@/shared/utils/resolve-public-author';
import {
  mapImages,
  mapSources,
  parseJsonArray,
  type Cuisine,
  type CuisineDetail,
  type CuisineUsahaLink,
} from '../domain/entities/culinary.entity';
import type {
  CreateCuisineInput,
  CreateLinkInput,
  CulinaryRepository,
  ListCuisinesInput,
  ListResult,
  UpdateCuisineInput,
  UpdateLinkInput,
  NewCuisineCommentInput,
  CuisineCommentListFilter,
} from '../domain/repositories/culinary.repository';
import type { CuisineComment } from '../domain/entities/culinary.entity';
import type { CursorPage } from '@/modules/word/domain/repositories/word.repository';
import {
  entityCommentAudioInsertValues,
  entityCommentImageInsertValues,
  toEntityCommentAudio,
  toEntityCommentImage,
} from '@/shared/comment/entity-comment-media';

type CuisineRow = typeof cuisines.$inferSelect;
const COMMENT_REVISION_CAP = 50;
type CuisineCommentRow = typeof cuisineComments.$inferSelect;

function toCuisineComment(
  row: CuisineCommentRow,
  meta: {
    username: string | null;
    displayName: string | null;
    avatarUrl: string | null;
    userRole: string | null;
    authorDeletedAt: Date | null;
    isEdited: boolean;
  },
): CuisineComment {
  return {
    id: row.id,
    cuisineId: row.cuisineId,
    userId: row.userId,
    username: meta.authorDeletedAt ? null : meta.username,
    displayName: meta.authorDeletedAt ? null : meta.displayName,
    avatarUrl: meta.authorDeletedAt ? null : meta.avatarUrl,
    userRole: meta.authorDeletedAt ? null : meta.userRole,
    authorDeletedAt: meta.authorDeletedAt,
    body: row.body,
    stickerId: row.stickerId ?? null,
    audio: toEntityCommentAudio(row),
    image: toEntityCommentImage(row),
    status: row.status,
    isEdited: meta.isEdited,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt ?? null,
  };
}

const cuisineSelect = {
  ...getTableColumns(cuisines),
  categoryName: culinaryCategories.name,
};

function mapCuisine(row: CuisineRow & { categoryName: string | null }): Cuisine {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    description: row.description ?? null,
    categoryId: row.categoryId ?? null,
    category:
      row.categoryId && row.categoryName
        ? { id: row.categoryId, name: row.categoryName }
        : null,
    originRegion: row.originRegion ?? null,
    images: mapImages(row.imagesJson),
    ingredients: parseJsonArray<string>(row.ingredientsJson),
    servingSuggestion: row.servingSuggestion ?? null,
    tags: parseJsonArray<string>(row.tagsJson),
    sources: mapSources(row.sourcesJson),
    license: row.license ?? null,
    publishStatus: row.publishStatus,
    restrictedReason: row.restrictedReason ?? null,
    restrictedAt: row.restrictedAt ?? null,
    authorId: row.authorId ?? null,
    author: null,
    publishedAt: row.publishedAt ?? null,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt ?? null,
  };
}

type LinkRow = typeof cuisineUsahas.$inferSelect;

function mapLink(
  row: LinkRow,
  cuisineName: string | null,
  cuisineSlug: string | null,
  usahaName: string | null,
  usahaSlug: string | null,
): CuisineUsahaLink {
  return {
    id: row.id,
    cuisineId: row.cuisineId,
    usahaId: row.usahaId,
    availability: row.availability,
    note: row.note ?? null,
    cuisineName,
    cuisineSlug,
    usahaName,
    usahaSlug,
  };
}

const isUniqueError = (e: unknown): boolean => {
  const msg = e instanceof Error ? e.message : String(e);
  return msg.includes('UNIQUE') || msg.includes('unique');
};

export class CulinaryRepositoryImpl implements CulinaryRepository {
  constructor(private readonly db: AppDatabase) {}

  // ------------------------------------------------------------- kuliner --
  async createCuisine(input: CreateCuisineInput): Promise<Cuisine> {
    const id = input.id ?? generateId();
    const now = new Date();
    try {
      await this.db.insert(cuisines).values({
        id,
        slug: input.slug,
        name: input.name,
        description: input.description ?? null,
        categoryId: input.categoryId ?? null,
        originRegion: input.originRegion ?? null,
        imagesJson: input.imagesJson ?? null,
        ingredientsJson: input.ingredientsJson ?? null,
        servingSuggestion: input.servingSuggestion ?? null,
        tagsJson: input.tagsJson ?? null,
        sourcesJson: input.sourcesJson ?? null,
        license: input.license ?? null,
        publishStatus: input.publishStatus ?? 'published',
        publishedAt:
          input.publishStatus === undefined || input.publishStatus === 'published'
            ? now
            : null,
        authorId: input.authorId ?? null,
      });
    } catch (e) {
      if (isUniqueError(e)) {
        throw new ConflictError('SLUG_TAKEN', 'Slug kuliner sudah dipakai');
      }
      throw e;
    }
    const created = await this.findCuisineById(id);
    if (!created) throw new Error('Kuliner create gagal - row tidak ketemu');
    return created;
  }

  async updateCuisine(input: UpdateCuisineInput): Promise<Cuisine | null> {
    const values: Partial<typeof cuisines.$inferInsert> = {
      updatedAt: new Date(),
    };
    if (input.slug !== undefined) values.slug = input.slug;
    if (input.name !== undefined) values.name = input.name;
    if (input.description !== undefined) values.description = input.description;
    if (input.categoryId !== undefined) values.categoryId = input.categoryId;
    if (input.originRegion !== undefined) values.originRegion = input.originRegion;
    if (input.imagesJson !== undefined) values.imagesJson = input.imagesJson;
    if (input.ingredientsJson !== undefined)
      values.ingredientsJson = input.ingredientsJson;
    if (input.servingSuggestion !== undefined)
      values.servingSuggestion = input.servingSuggestion;
    if (input.tagsJson !== undefined) values.tagsJson = input.tagsJson;
    if (input.sourcesJson !== undefined) values.sourcesJson = input.sourcesJson;
    if (input.license !== undefined) values.license = input.license;
    if (input.publishStatus !== undefined) {
      values.publishStatus = input.publishStatus;
      if (input.publishStatus === 'published') values.publishedAt = new Date();
    }
    if (input.restricted === null) {
      values.restrictedReason = null;
      values.restrictedAt = null;
    } else if (input.restricted) {
      values.restrictedReason = input.restricted.reason;
      values.restrictedAt = new Date();
    }
    try {
      await this.db
        .update(cuisines)
        .set(values)
        .where(and(eq(cuisines.id, input.id), isNull(cuisines.deletedAt)));
    } catch (e) {
      if (isUniqueError(e)) {
        throw new ConflictError('SLUG_TAKEN', 'Slug kuliner sudah dipakai');
      }
      throw e;
    }
    return this.findCuisineById(input.id);
  }

  async softDeleteCuisine(id: string): Promise<boolean> {
    const rows = await this.db
      .update(cuisines)
      .set({ deletedAt: new Date(), updatedAt: new Date() })
      .where(and(eq(cuisines.id, id), isNull(cuisines.deletedAt)))
      .returning({ id: cuisines.id });
    return rows.length > 0;
  }

  async findCuisineById(id: string): Promise<CuisineDetail | null> {
    const [row] = await this.db
      .select(cuisineSelect)
      .from(cuisines)
      .leftJoin(culinaryCategories, eq(culinaryCategories.id, cuisines.categoryId))
      .where(and(eq(cuisines.id, id), isNull(cuisines.deletedAt)))
      .limit(1);
    if (!row) return null;
    return { ...mapCuisine(row), usahas: await this.linksForCuisine(row.id) };
  }

  async findCuisineBySlug(
    slug: string,
    opts?: { publicOnly?: boolean },
  ): Promise<CuisineDetail | null> {
    const conds = [eq(cuisines.slug, slug), isNull(cuisines.deletedAt)];
    if (opts?.publicOnly) conds.push(eq(cuisines.publishStatus, 'published'));
    const [row] = await this.db
      .select(cuisineSelect)
      .from(cuisines)
      .leftJoin(culinaryCategories, eq(culinaryCategories.id, cuisines.categoryId))
      .where(and(...conds))
      .limit(1);
    if (!row) return null;
    const detail: CuisineDetail = {
      ...mapCuisine(row),
      usahas: await this.linksForCuisine(row.id),
    };
    detail.author = await resolvePublicAuthor(this.db, detail.authorId);
    return detail;
  }

  async listCuisines(input: ListCuisinesInput): Promise<ListResult<Cuisine>> {
    const conds = [isNull(cuisines.deletedAt)];
    if (input.publicOnly) conds.push(eq(cuisines.publishStatus, 'published'));
    else if (input.status) conds.push(eq(cuisines.publishStatus, input.status));
    if (input.categoryId) conds.push(eq(cuisines.categoryId, input.categoryId));
    if (input.q?.trim()) {
      const q = `%${input.q.trim()}%`;
      conds.push(or(ilikeCompat(cuisines.name, q), ilikeCompat(cuisines.slug, q))!);
    }
    // Keyset harus cocok dengan ORDER BY (created_at, id) DESC.
    // Cursor tidak ketemu → halaman kosong (jangan jatuh ke page 1).
    if (input.before) {
      const [cursor] = await this.db
        .select({ id: cuisines.id, createdAt: cuisines.createdAt })
        .from(cuisines)
        .where(eq(cuisines.id, input.before))
        .limit(1);
      if (!cursor) {
        return { items: [], nextCursor: null };
      }
      conds.push(
        or(
          lt(cuisines.createdAt, cursor.createdAt),
          and(eq(cuisines.createdAt, cursor.createdAt), lt(cuisines.id, cursor.id)),
        )!,
      );
    }
    const rows = await this.db
      .select(cuisineSelect)
      .from(cuisines)
      .leftJoin(culinaryCategories, eq(culinaryCategories.id, cuisines.categoryId))
      .where(and(...conds))
      .orderBy(desc(cuisines.createdAt), desc(cuisines.id))
      .limit(input.limit + 1);
    const hasMore = rows.length > input.limit;
    const page = hasMore ? rows.slice(0, input.limit) : rows;
    const items = page.map(mapCuisine);
    return {
      items,
      nextCursor: hasMore ? items[items.length - 1].id : null,
    };
  }

  async existingCuisineSlugs(slugs: string[]): Promise<Set<string>> {
    if (slugs.length === 0) return new Set();
    const rows = await this.db
      .select({ slug: cuisines.slug })
      .from(cuisines)
      .where(inArray(cuisines.slug, slugs));
    return new Set(rows.map((r) => r.slug));
  }

  async findCuisineDuplicates(input: {
    q: string;
    excludeId?: string;
  }): Promise<Array<{ id: string; slug: string; name: string }>> {
    const term = input.q.trim().toLowerCase();
    if (!term) return [];
    const conds = [
      isNull(cuisines.deletedAt),
      ne(cuisines.publishStatus, 'archived'),
      sql`lower(trim(${cuisines.name})) like ${`%${term}%`}`,
    ];
    if (input.excludeId) conds.push(ne(cuisines.id, input.excludeId));
    const rows = await this.db
      .select({ id: cuisines.id, slug: cuisines.slug, name: cuisines.name })
      .from(cuisines)
      .where(and(...conds))
      .limit(10);
    return rows;
  }

  // ------------------------------------------------------------- relasi --
  async createLink(input: CreateLinkInput): Promise<CuisineUsahaLink> {
    const id = input.id ?? generateId();
    try {
      await this.db.insert(cuisineUsahas).values({
        id,
        cuisineId: input.cuisineId,
        usahaId: input.usahaId,
        availability: input.availability ?? 'unknown',
        note: input.note ?? null,
        publishStatus: input.publishStatus ?? 'published',
        authorId: input.authorId ?? null,
      });
    } catch (e) {
      if (isUniqueError(e)) {
        throw new ConflictError(
          'LINK_EXISTS',
          'Hubungan kuliner dan usaha ini sudah ada',
        );
      }
      throw e;
    }
    const created = await this.findLinkById(id);
    if (!created) throw new Error('Relasi create gagal - row tidak ketemu');
    return created;
  }

  async updateLink(input: UpdateLinkInput): Promise<CuisineUsahaLink | null> {
    const values: Partial<typeof cuisineUsahas.$inferInsert> = {
      updatedAt: new Date(),
    };
    if (input.availability !== undefined) values.availability = input.availability;
    if (input.note !== undefined) values.note = input.note;
    if (input.publishStatus !== undefined)
      values.publishStatus = input.publishStatus;
    await this.db
      .update(cuisineUsahas)
      .set(values)
      .where(
        and(
          eq(cuisineUsahas.id, input.id),
          isNull(cuisineUsahas.deletedAt),
        ),
      );
    return this.findLinkById(input.id);
  }

  async softDeleteLink(id: string): Promise<boolean> {
    const rows = await this.db
      .update(cuisineUsahas)
      .set({ deletedAt: new Date(), updatedAt: new Date() })
      .where(
        and(
          eq(cuisineUsahas.id, id),
          isNull(cuisineUsahas.deletedAt),
        ),
      )
      .returning({ id: cuisineUsahas.id });
    return rows.length > 0;
  }

  async findLinkById(id: string): Promise<CuisineUsahaLink | null> {
    const [row] = await this.db
      .select({
        link: cuisineUsahas,
        cuisineName: cuisines.name,
        cuisineSlug: cuisines.slug,
        usahaName: usahas.name,
        usahaSlug: usahas.slug,
      })
      .from(cuisineUsahas)
      .leftJoin(cuisines, eq(cuisines.id, cuisineUsahas.cuisineId))
      .leftJoin(usahas, eq(usahas.id, cuisineUsahas.usahaId))
      .where(eq(cuisineUsahas.id, id))
      .limit(1);
    if (!row) return null;
    return mapLink(
      row.link,
      row.cuisineName ?? null,
      row.cuisineSlug ?? null,
      row.usahaName ?? null,
      row.usahaSlug ?? null,
    );
  }

  async findLinkByPair(
    cuisineId: string,
    usahaId: string,
  ): Promise<CuisineUsahaLink | null> {
    const [row] = await this.db
      .select({
        link: cuisineUsahas,
        cuisineName: cuisines.name,
        cuisineSlug: cuisines.slug,
        usahaName: usahas.name,
        usahaSlug: usahas.slug,
      })
      .from(cuisineUsahas)
      .leftJoin(cuisines, eq(cuisines.id, cuisineUsahas.cuisineId))
      .leftJoin(usahas, eq(usahas.id, cuisineUsahas.usahaId))
      .where(
        and(
          eq(cuisineUsahas.cuisineId, cuisineId),
          eq(cuisineUsahas.usahaId, usahaId),
          isNull(cuisineUsahas.deletedAt),
        ),
      )
      .limit(1);
    if (!row) return null;
    return mapLink(
      row.link,
      row.cuisineName ?? null,
      row.cuisineSlug ?? null,
      row.usahaName ?? null,
      row.usahaSlug ?? null,
    );
  }

  async linksForCuisine(cuisineId: string): Promise<CuisineUsahaLink[]> {
    const rows = await this.db
      .select({
        link: cuisineUsahas,
        usahaName: usahas.name,
        usahaSlug: usahas.slug,
      })
      .from(cuisineUsahas)
      // INNER JOIN: relasi hanya tayang bila usahanya juga published.
      .innerJoin(usahas, eq(usahas.id, cuisineUsahas.usahaId))
      .where(
        and(
          eq(cuisineUsahas.cuisineId, cuisineId),
          eq(cuisineUsahas.publishStatus, 'published'),
          isNull(cuisineUsahas.deletedAt),
          eq(usahas.publishStatus, 'published'),
          isNull(usahas.deletedAt),
        ),
      )
      .orderBy(asc(usahas.name))
      .limit(100);
    return rows.map((r) =>
      mapLink(r.link, null, null, r.usahaName ?? null, r.usahaSlug ?? null),
    );
  }

  // ---------------------------------------------------------- kategori --
  async categoryRef(categoryId: string) {
    const [row] = await this.db
      .select({ id: culinaryCategories.id, name: culinaryCategories.name })
      .from(culinaryCategories)
      .where(
        and(
          eq(culinaryCategories.id, categoryId),
          isNull(culinaryCategories.deletedAt),
        ),
      )
      .limit(1);
    return row ?? null;
  }

  async listCategories(publicOnly: boolean) {
    const conds = [isNull(culinaryCategories.deletedAt)];
    if (publicOnly) conds.push(eq(culinaryCategories.status, 'published'));
    return this.db
      .select({ id: culinaryCategories.id, name: culinaryCategories.name })
      .from(culinaryCategories)
      .where(and(...conds))
      .orderBy(culinaryCategories.sortOrder, culinaryCategories.name);
  }

  // ---------------------------------------------------------------- komentar
  async createComment(input: NewCuisineCommentInput): Promise<CuisineComment> {
    const [row] = await this.db
      .insert(cuisineComments)
      .values({
        cuisineId: input.cuisineId,
        userId: input.userId,
        body: input.body,
        bodyOriginal: input.bodyOriginal,
        stickerId: input.stickerId ?? null,
        ...entityCommentImageInsertValues(input.image),
        ...entityCommentAudioInsertValues(input.audio),
        createdAt: new Date(),
      })
      .returning();
    if (!row) throw new Error('gagal menyimpan komentar kuliner');
    const comment = await this.findCommentById(row.id);
    if (!comment) throw new Error('komentar kuliner tidak ditemukan setelah dibuat');
    return comment;
  }

  async findCommentById(id: string): Promise<CuisineComment | null> {
    const [row] = await this.db
      .select({
        c: cuisineComments,
        username: users.username,
        displayName: users.displayName,
        avatarUrl: users.avatarUrl,
        authorDeletedAt: users.deletedAt,
        userRole: highestUserRoleSql,
        isEdited: sql<boolean>`EXISTS (
          SELECT 1 FROM ${cuisineCommentRevisions}
          WHERE ${cuisineCommentRevisions.commentId} = ${cuisineComments.id}
        )`,
      })
      .from(cuisineComments)
      .leftJoin(users, eq(users.id, cuisineComments.userId))
      .where(eq(cuisineComments.id, id))
      .limit(1);
    if (!row) return null;
    return toCuisineComment(row.c, {
      username: row.username,
      displayName: row.displayName,
      avatarUrl: row.avatarUrl,
      userRole: row.userRole,
      authorDeletedAt: row.authorDeletedAt,
      isEdited: Boolean(row.isEdited),
    });
  }

  async listComments(
    cuisineId: string,
    filter: CuisineCommentListFilter,
  ): Promise<CursorPage<CuisineComment>> {
    const limit = filter.limit;
    const conditions = [eq(cuisineComments.cuisineId, cuisineId)];
    if (filter.status) conditions.push(eq(cuisineComments.status, filter.status));
    if (filter.cursor) conditions.push(lt(cuisineComments.id, filter.cursor));
    const rows = await this.db
      .select({
        c: cuisineComments,
        username: users.username,
        displayName: users.displayName,
        avatarUrl: users.avatarUrl,
        authorDeletedAt: users.deletedAt,
        userRole: highestUserRoleSql,
        isEdited: sql<boolean>`EXISTS (
          SELECT 1 FROM ${cuisineCommentRevisions}
          WHERE ${cuisineCommentRevisions.commentId} = ${cuisineComments.id}
        )`,
      })
      .from(cuisineComments)
      .leftJoin(users, eq(users.id, cuisineComments.userId))
      .where(and(...conditions))
      .orderBy(desc(cuisineComments.id))
      .limit(limit + 1);
    const hasMore = rows.length > limit;
    const page = hasMore ? rows.slice(0, limit) : rows;
    return {
      items: page.map((row) =>
        toCuisineComment(row.c, {
          username: row.username,
          displayName: row.displayName,
          avatarUrl: row.avatarUrl,
          userRole: row.userRole,
          authorDeletedAt: row.authorDeletedAt,
          isEdited: Boolean(row.isEdited),
        }),
      ),
      nextCursor: hasMore ? (page[page.length - 1]?.c.id ?? null) : null,
      hasMore,
    };
  }

  async updateCommentWithRevision(input: {
    commentId: string;
    editorId: string;
    body: string;
  }): Promise<CuisineComment | null> {
    const now = new Date();
    const updated = await this.db.transaction(async (tx) => {
      const [current] = await tx
        .select({ body: cuisineComments.body })
        .from(cuisineComments)
        .where(eq(cuisineComments.id, input.commentId))
        .limit(1);
      if (!current) return null;
      await tx.insert(cuisineCommentRevisions).values({
        commentId: input.commentId,
        editorId: input.editorId,
        body: current.body,
        createdAt: now,
      });
      const excess = await tx
        .select({ id: cuisineCommentRevisions.id })
        .from(cuisineCommentRevisions)
        .where(eq(cuisineCommentRevisions.commentId, input.commentId))
        .orderBy(desc(cuisineCommentRevisions.createdAt))
        .offset(COMMENT_REVISION_CAP);
      if (excess.length > 0) {
        await tx
          .delete(cuisineCommentRevisions)
          .where(inArray(cuisineCommentRevisions.id, excess.map((r) => r.id)));
      }
      const [row] = await tx
        .update(cuisineComments)
        .set({ body: input.body, updatedAt: now })
        .where(
          and(
            eq(cuisineComments.id, input.commentId),
            eq(cuisineComments.status, 'published'),
            eq(cuisineComments.userId, input.editorId),
          ),
        )
        .returning({ id: cuisineComments.id });
      return row?.id ?? null;
    });
    if (!updated) return null;
    return this.findCommentById(updated);
  }

  async markCommentDeletedByAuthor(id: string, actorId: string): Promise<boolean> {
    const [row] = await this.db
      .update(cuisineComments)
      .set({ status: 'deleted_by_author', deletedAt: new Date() })
      .where(
        and(
          eq(cuisineComments.id, id),
          eq(cuisineComments.userId, actorId),
          eq(cuisineComments.status, 'published'),
        ),
      )
      .returning({ id: cuisineComments.id });
    return Boolean(row);
  }

  async takedownComment(id: string, actorId: string): Promise<boolean> {
    const [row] = await this.db
      .update(cuisineComments)
      .set({ status: 'taken_down', reviewedBy: actorId, reviewedAt: new Date() })
      .where(and(eq(cuisineComments.id, id), eq(cuisineComments.status, 'published')))
      .returning({ id: cuisineComments.id });
    return Boolean(row);
  }

  async cuisineTargetExists(id: string): Promise<boolean> {
    const [row] = await this.db
      .select({ id: cuisines.id })
      .from(cuisines)
      .where(
        and(
          eq(cuisines.id, id),
          eq(cuisines.publishStatus, 'published'),
          isNull(cuisines.deletedAt),
        ),
      )
      .limit(1);
    return Boolean(row);
  }
}
