import { and, desc, eq, inArray, lt, or, sql } from 'drizzle-orm';
import {
  articleBookmarks,
  articleCommentRevisions,
  articleComments,
  articleContributions,
  articleRevisions,
  articleTags,
  articles,
  encyclopediaCategories,
  encyclopediaTags,
  users,
} from '@/shared/database/drizzle/schema';
import { highestUserRoleSql } from '@/shared/database/highest-user-role-sql';
import type { AppDatabase } from '@/shared/database/drizzle/client';
import type { CursorPage } from '@/modules/word/domain/repositories/word.repository';
import type {
  ArticleCommentStatus,
  ArticleContributionKind,
  ArticleContributionStatus,
  ArticleStatus,
} from '@/shared/database/drizzle/schema/encyclopedia.schema';
import type {
  Article,
  ArticleComment,
  ArticleContribution,
  ArticlePayload,
  ArticleRevision,
  EncyclopediaCategory,
  EncyclopediaTag,
} from '../domain/entities/encyclopedia.entity';
import type {
  ArticleCommentListFilter,
  ArticleListFilter,
  ArticleRepository,
  ContributionListFilter,
  NewArticleCommentInput,
  NewArticleContributionInput,
  NewArticleInput,
  NewRevisionInput,
  UpdateArticleInput,
} from '../domain/repositories/encyclopedia.repository';

/** Cap riwayat revisi per artikel (sama seperti komentar pantun). */
const ARTICLE_REVISION_CAP = 50;
const COMMENT_REVISION_CAP = 50;

type ArticleRow = typeof articles.$inferSelect;
type CommentRow = typeof articleComments.$inferSelect;
type ContributionRow = typeof articleContributions.$inferSelect;
type RevisionRow = typeof articleRevisions.$inferSelect;

/** Term FTS trigram minimal 3 karakter; lebih pendek jatuh ke LIKE. */
function ftsMatch(terms: string[]): string | null {
  const usable = terms.filter((t) => t.length >= 3 && !t.includes('"'));
  if (usable.length === 0) return null;
  return usable.map((t) => `"${t}"`).join(' OR ');
}

function toTags(raw: unknown): string[] {
  if (Array.isArray(raw)) return raw.map((x) => String(x));
  if (typeof raw === 'string') {
    try {
      const parsed: unknown = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed.map((x) => String(x)) : [];
    } catch {
      return [];
    }
  }
  return [];
}

function toPayload(raw: string): ArticlePayload {
  const parsed = JSON.parse(raw) as Partial<ArticlePayload>;
  return {
    title: String(parsed.title ?? ''),
    excerpt: String(parsed.excerpt ?? ''),
    body_md: String(parsed.body_md ?? ''),
    category_id: String(parsed.category_id ?? ''),
    tags: toTags(parsed.tags),
    cover_url: parsed.cover_url ?? null,
    source_url: parsed.source_url ?? null,
    references_md: parsed.references_md ?? null,
  };
}

function toArticle(row: ArticleRow, tags: string[]): Article {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    excerpt: row.excerpt,
    bodyMd: row.bodyMd,
    bodyText: row.bodyText,
    coverUrl: row.coverUrl,
    categoryId: row.categoryId,
    categoryName: null,
    sourceUrl: row.sourceUrl,
    referencesMd: row.referencesMd,
    authorUserId: row.authorUserId,
    authorUsername: null,
    authorDisplayName: null,
    authorAvatarUrl: null,
    authorDeletedAt: null,
    status: row.status as ArticleStatus,
    tags,
    publishedAt: row.publishedAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function toComment(
  row: CommentRow,
  profile: {
    username: string | null;
    displayName: string | null;
    avatarUrl: string | null;
    userRole: string | null;
    authorDeletedAt: Date | null;
    isEdited: boolean;
  },
): ArticleComment {
  return {
    id: row.id,
    articleId: row.articleId,
    userId: row.userId,
    username: profile.username,
    displayName: profile.displayName,
    avatarUrl: profile.avatarUrl,
    userRole: profile.userRole,
    authorDeletedAt: profile.authorDeletedAt,
    body: row.body,
    imageUrl: row.imageUrl,
    status: row.status as ArticleCommentStatus,
    isEdited: profile.isEdited,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export class EncyclopediaRepositoryImpl implements ArticleRepository {
  constructor(private readonly db: AppDatabase) {}

  /** Tags satu halaman artikel dalam SATU query (bukan per baris). */
  private async loadTagsByArticle(articleIds: string[]): Promise<Map<string, string[]>> {
    if (articleIds.length === 0) return new Map();
    const rows = await this.db
      .select({ articleId: articleTags.articleId, slug: encyclopediaTags.slug })
      .from(articleTags)
      .innerJoin(encyclopediaTags, eq(encyclopediaTags.id, articleTags.tagId))
      .where(inArray(articleTags.articleId, articleIds));
    const map = new Map<string, string[]>();
    for (const row of rows) {
      const list = map.get(row.articleId);
      if (list) list.push(row.slug);
      else map.set(row.articleId, [row.slug]);
    }
    return map;
  }

  private async attachTags(rows: ArticleRow[]): Promise<Article[]> {
    if (rows.length === 0) return [];
    const tagMap = await this.loadTagsByArticle(rows.map((r) => r.id));
    return rows.map((row) => toArticle(row, tagMap.get(row.id) ?? []));
  }

  // ---------------------------------------------------------------- artikel

  async create(input: NewArticleInput): Promise<Article> {
    const now = new Date();
    const tagMap = await this.ensureTags(input.tags);
    const id = await this.db.transaction(async (tx) => {
      const [row] = await tx
        .insert(articles)
        .values({
          slug: input.slug,
          title: input.title,
          excerpt: input.excerpt,
          bodyMd: input.bodyMd,
          bodyText: input.bodyText,
          coverUrl: input.coverUrl ?? null,
          categoryId: input.categoryId,
          sourceUrl: input.sourceUrl ?? null,
          referencesMd: input.referencesMd ?? null,
          authorUserId: input.authorUserId,
          status: input.status,
          publishedAt: input.status === 'published' ? now : null,
          createdAt: now,
        })
        .returning({ id: articles.id });
      if (!row) throw new Error('gagal menyimpan artikel');
      const tagIds = [...tagMap.values()].map((t) => t.id);
      if (tagIds.length > 0) {
        await tx.insert(articleTags).values(
          tagIds.map((tagId) => ({ articleId: row.id, tagId, createdAt: now })),
        );
      }
      return row.id;
    });
    const created = await this.findById(id);
    if (!created) throw new Error('artikel tidak ditemukan setelah dibuat');
    return created;
  }

  async findById(id: string): Promise<Article | null> {
    const [row] = await this.db
      .select()
      .from(articles)
      .where(and(eq(articles.id, id), sql`${articles.deletedAt} is null`))
      .limit(1);
    if (!row) return null;
    const [article] = await this.attachTags([row]);
    return article ?? null;
  }

  async findBySlug(slug: string): Promise<Article | null> {
    const [row] = await this.db
      .select()
      .from(articles)
      .where(and(eq(articles.slug, slug), sql`${articles.deletedAt} is null`))
      .limit(1);
    if (!row) return null;
    const [article] = await this.attachTags([row]);
    return article ?? null;
  }

  async list(filter: ArticleListFilter): Promise<CursorPage<Article>> {
    const limit = filter.limit;
    const conditions = [sql`${articles.deletedAt} is null`];
    if (filter.status) conditions.push(eq(articles.status, filter.status));
    if (filter.categoryId) conditions.push(eq(articles.categoryId, filter.categoryId));
    if (filter.tags && filter.tags.length > 0) {
      // Satu subquery IN untuk semua slug tag (bukan per tag).
      conditions.push(
        sql`${articles.id} IN (
          SELECT at.article_id FROM article_tags at
          INNER JOIN encyclopedia_tags t ON t.id = at.tag_id
          WHERE t.slug IN (${sql.join(
            filter.tags.map((t) => sql`${t}`),
            sql`, `,
          )})
        )`,
      );
    }
    // Cursor tidak ketemu → halaman kosong (jangan jatuh ke page 1).
    if (filter.cursor) {
      const [row] = await this.db
        .select({ id: articles.id, createdAt: articles.createdAt })
        .from(articles)
        .where(eq(articles.id, filter.cursor))
        .limit(1);
      if (!row) {
        return { items: [], nextCursor: null, hasMore: false };
      }
      conditions.push(
        or(
          lt(articles.createdAt, row.createdAt),
          and(eq(articles.createdAt, row.createdAt), lt(articles.id, row.id)),
        )!,
      );
    }

    // FTS / LIKE: hasil pencarian jadi prefilter id, tetap satu query list.
    if (filter.q && filter.q.trim().length > 0) {
      const terms = [
        ...new Set(filter.q.trim().toLowerCase().split(/\s+/).filter(Boolean)),
      ].slice(0, 5);
      const match = ftsMatch(terms);
      if (match) {
        conditions.push(
          sql`${articles.id} IN (
            SELECT owner_id FROM articles_search_fts
            WHERE articles_search_fts MATCH ${match}
          )`,
        );
      } else if (terms.length > 0) {
        const like = `%${terms[0]}%`;
        conditions.push(
          sql`(${articles.title} LIKE ${like} OR ${articles.excerpt} LIKE ${like} OR ${articles.bodyText} LIKE ${like})`,
        );
      }
    }

    const rows = await this.db
      .select()
      .from(articles)
      .where(and(...conditions))
      .orderBy(desc(articles.createdAt), desc(articles.id))
      .limit(limit + 1);
    const hasMore = rows.length > limit;
    const page = hasMore ? rows.slice(0, limit) : rows;
    const items = await this.attachTags(page);
    return {
      items,
      nextCursor: hasMore ? (page[page.length - 1]?.id ?? null) : null,
      hasMore,
    };
  }

  async updateWithRevision(input: {
    id: string;
    patch: UpdateArticleInput;
    revision: NewRevisionInput;
  }): Promise<Article | null> {
    const now = new Date();
    const patch = input.patch;
    const tagMap =
      patch.tags !== undefined ? await this.ensureTags(patch.tags) : null;

    const updated = await this.db.transaction(async (tx) => {
      await tx.insert(articleRevisions).values({
        articleId: input.revision.articleId,
        editorId: input.revision.editorId,
        contributionId: input.revision.contributionId,
        title: input.revision.previous.title,
        excerpt: input.revision.previous.excerpt,
        bodyMd: input.revision.previous.bodyMd,
        categoryId: input.revision.previous.categoryId,
        tagsJson: JSON.stringify(input.revision.previous.tags),
        changeNote: input.revision.changeNote,
        createdAt: now,
      });
      const excess = await tx
        .select({ id: articleRevisions.id })
        .from(articleRevisions)
        .where(eq(articleRevisions.articleId, input.revision.articleId))
        .orderBy(desc(articleRevisions.createdAt))
        .offset(ARTICLE_REVISION_CAP);
      if (excess.length > 0) {
        await tx
          .delete(articleRevisions)
          .where(inArray(articleRevisions.id, excess.map((r) => r.id)));
      }

      const [row] = await tx
        .update(articles)
        .set({
          ...(patch.title !== undefined ? { title: patch.title } : {}),
          ...(patch.excerpt !== undefined ? { excerpt: patch.excerpt } : {}),
          ...(patch.bodyMd !== undefined ? { bodyMd: patch.bodyMd } : {}),
          ...(patch.bodyText !== undefined ? { bodyText: patch.bodyText } : {}),
          ...(patch.categoryId !== undefined ? { categoryId: patch.categoryId } : {}),
          ...(patch.coverUrl !== undefined ? { coverUrl: patch.coverUrl } : {}),
          ...(patch.sourceUrl !== undefined ? { sourceUrl: patch.sourceUrl } : {}),
          ...(patch.referencesMd !== undefined
            ? { referencesMd: patch.referencesMd }
            : {}),
          ...(patch.status !== undefined
            ? {
                status: patch.status,
                ...(patch.status === 'published' ? { publishedAt: now } : {}),
              }
            : {}),
          updatedAt: now,
        })
        .where(and(eq(articles.id, input.id), sql`${articles.deletedAt} is null`))
        .returning({ id: articles.id });
      if (!row) return null;

      if (tagMap) {
        await tx.delete(articleTags).where(eq(articleTags.articleId, row.id));
        const tagIds = [...tagMap.values()].map((t) => t.id);
        if (tagIds.length > 0) {
          await tx.insert(articleTags).values(
            tagIds.map((tagId) => ({ articleId: row.id, tagId, createdAt: now })),
          );
        }
      }
      return row.id;
    });

    if (!updated) return null;
    return this.findById(updated);
  }

  async setStatus(
    id: string,
    status: 'draft' | 'published' | 'archived',
    _actorId: string,
  ): Promise<Article | null> {
    const now = new Date();
    const [row] = await this.db
      .update(articles)
      .set({
        status,
        ...(status === 'published' ? { publishedAt: now } : {}),
        updatedAt: now,
      })
      .where(and(eq(articles.id, id), sql`${articles.deletedAt} is null`))
      .returning({ id: articles.id });
    if (!row) return null;
    return this.findById(row.id);
  }

  async markDeleted(id: string): Promise<boolean> {
    const [row] = await this.db
      .update(articles)
      .set({ deletedAt: new Date(), status: 'archived' })
      .where(and(eq(articles.id, id), sql`${articles.deletedAt} is null`))
      .returning({ id: articles.id });
    return Boolean(row);
  }

  async deleteHard(id: string): Promise<boolean> {
    const [row] = await this.db
      .delete(articles)
      .where(eq(articles.id, id))
      .returning({ id: articles.id });
    return Boolean(row);
  }

  async searchPublished(q: string, limit: number): Promise<Article[]> {
    const terms = [
      ...new Set(q.trim().toLowerCase().split(/\s+/).filter(Boolean)),
    ].slice(0, 5);
    if (terms.length === 0) return [];
    const match = ftsMatch(terms);
    const rows = match
      ? await this.db.all<ArticleRow>(sql`
          SELECT a.* FROM articles a
          INNER JOIN (
            SELECT owner_id, rank FROM (
              SELECT owner_id, bm25(articles_search_fts) AS rank,
                row_number() OVER (PARTITION BY owner_id ORDER BY bm25(articles_search_fts)) rn
              FROM articles_search_fts WHERE articles_search_fts MATCH ${match}
            ) WHERE rn = 1
            ORDER BY rank LIMIT ${limit}
          ) h ON h.owner_id = a.id
          WHERE a.status = 'published' AND a.deleted_at IS NULL
          ORDER BY h.rank
        `)
      : await this.db.all<ArticleRow>(sql`
          SELECT * FROM articles
          WHERE status = 'published' AND deleted_at IS NULL
            AND (title LIKE ${`%${terms[0]}%`} OR excerpt LIKE ${`%${terms[0]}%`})
          ORDER BY created_at DESC LIMIT ${limit}
        `);
    return this.attachTags(rows);
  }

  // ------------------------------------------------------------- kategori

  async listCategories(): Promise<EncyclopediaCategory[]> {
    const rows = await this.db
      .select()
      .from(encyclopediaCategories)
      .where(sql`${encyclopediaCategories.deletedAt} is null`)
      .orderBy(encyclopediaCategories.sortOrder, encyclopediaCategories.name);
    return rows.map((r) => ({
      id: r.id,
      name: r.name,
      status: r.status,
      sortOrder: r.sortOrder,
    }));
  }

  async createCategory(input: {
    id: string;
    name: string;
    sortOrder: number;
  }): Promise<EncyclopediaCategory> {
    const [row] = await this.db
      .insert(encyclopediaCategories)
      .values({
        id: input.id,
        name: input.name,
        sortOrder: input.sortOrder,
        createdAt: new Date(),
      })
      .returning();
    if (!row) throw new Error('gagal menyimpan kategori');
    return {
      id: row.id,
      name: row.name,
      status: row.status,
      sortOrder: row.sortOrder,
    };
  }

  async updateCategory(
    id: string,
    patch: {
      name?: string;
      status?: 'draft' | 'published' | 'archived';
      sortOrder?: number;
    },
  ): Promise<EncyclopediaCategory | null> {
    const [row] = await this.db
      .update(encyclopediaCategories)
      .set({
        ...(patch.name !== undefined ? { name: patch.name } : {}),
        ...(patch.status !== undefined ? { status: patch.status } : {}),
        ...(patch.sortOrder !== undefined ? { sortOrder: patch.sortOrder } : {}),
        updatedAt: new Date(),
      })
      .where(eq(encyclopediaCategories.id, id))
      .returning();
    if (!row) return null;
    return {
      id: row.id,
      name: row.name,
      status: row.status,
      sortOrder: row.sortOrder,
    };
  }

  // ------------------------------------------------------------------ tag

  async listTags(q: string | undefined, limit: number): Promise<EncyclopediaTag[]> {
    const where = q && q.trim().length > 0
      ? sql`${encyclopediaTags.slug} LIKE ${`%${q.trim().toLowerCase()}%`}`
      : undefined;
    const query = this.db
      .select({ id: encyclopediaTags.id, slug: encyclopediaTags.slug, name: encyclopediaTags.name })
      .from(encyclopediaTags)
      .orderBy(encyclopediaTags.slug)
      .limit(limit);
    const rows = where ? await query.where(where) : await query;
    return rows;
  }

  async ensureTags(slugs: string[]): Promise<Map<string, EncyclopediaTag>> {
    const unique = [...new Set(slugs.map((s) => s.trim().toLowerCase()).filter(Boolean))];
    const map = new Map<string, EncyclopediaTag>();
    if (unique.length === 0) return map;
    const existing = await this.db
      .select()
      .from(encyclopediaTags)
      .where(inArray(encyclopediaTags.slug, unique));
    for (const row of existing) {
      map.set(row.slug, { id: row.id, slug: row.slug, name: row.name });
    }
    const missing = unique.filter((slug) => !map.has(slug));
    if (missing.length > 0) {
      const inserted = await this.db
        .insert(encyclopediaTags)
        .values(
          missing.map((slug) => ({
            slug,
            name: slug.replace(/-/g, ' '),
            createdAt: new Date(),
          })),
        )
        .onConflictDoNothing()
        .returning();
      for (const row of inserted) {
        map.set(row.slug, { id: row.id, slug: row.slug, name: row.name });
      }
      // Baris yang kalah race: ambil ulang sekali (bukan loop per slug).
      const stillMissing = unique.filter((slug) => !map.has(slug));
      if (stillMissing.length > 0) {
        const refetched = await this.db
          .select()
          .from(encyclopediaTags)
          .where(inArray(encyclopediaTags.slug, stillMissing));
        for (const row of refetched) {
          map.set(row.slug, { id: row.id, slug: row.slug, name: row.name });
        }
      }
    }
    return map;
  }

  async setArticleTags(articleId: string, tagIds: string[]): Promise<void> {
    const now = new Date();
    await this.db.transaction(async (tx) => {
      await tx.delete(articleTags).where(eq(articleTags.articleId, articleId));
      if (tagIds.length > 0) {
        await tx
          .insert(articleTags)
          .values(tagIds.map((tagId) => ({ articleId, tagId, createdAt: now })));
      }
    });
  }

  async renameTag(tagId: string, name: string): Promise<EncyclopediaTag | null> {
    const [row] = await this.db
      .update(encyclopediaTags)
      .set({ name })
      .where(eq(encyclopediaTags.id, tagId))
      .returning();
    if (!row) return null;
    return { id: row.id, slug: row.slug, name: row.name };
  }

  async mergeTag(fromTagId: string, intoTagId: string): Promise<void> {
    if (fromTagId === intoTagId) return;
    await this.db.transaction(async (tx) => {
      // Pindahkan junction, skip yang sudah punya target (composite PK).
      await tx.run(sql`
        INSERT OR IGNORE INTO article_tags (article_id, tag_id, created_at)
        SELECT article_id, ${intoTagId}, created_at FROM article_tags
        WHERE tag_id = ${fromTagId}
      `);
      await tx.delete(articleTags).where(eq(articleTags.tagId, fromTagId));
      await tx.delete(encyclopediaTags).where(eq(encyclopediaTags.id, fromTagId));
    });
  }

  // -------------------------------------------------------------- revisi

  async listRevisions(articleId: string): Promise<ArticleRevision[]> {
    const rows = await this.db
      .select({ rev: articleRevisions, username: users.username })
      .from(articleRevisions)
      .leftJoin(users, eq(users.id, articleRevisions.editorId))
      .where(eq(articleRevisions.articleId, articleId))
      .orderBy(desc(articleRevisions.createdAt));
    return rows.map(({ rev, username }) => this.toRevision(rev, username));
  }

  async findRevision(articleId: string, revisionId: string): Promise<ArticleRevision | null> {
    const [row] = await this.db
      .select({ rev: articleRevisions, username: users.username })
      .from(articleRevisions)
      .leftJoin(users, eq(users.id, articleRevisions.editorId))
      .where(
        and(
          eq(articleRevisions.id, revisionId),
          eq(articleRevisions.articleId, articleId),
        ),
      )
      .limit(1);
    return row ? this.toRevision(row.rev, row.username) : null;
  }

  private toRevision(row: RevisionRow, username: string | null): ArticleRevision {
    return {
      id: row.id,
      articleId: row.articleId,
      editorId: row.editorId,
      editorUsername: username,
      contributionId: row.contributionId,
      title: row.title,
      excerpt: row.excerpt,
      bodyMd: row.bodyMd,
      categoryId: row.categoryId,
      tags: toTags(row.tagsJson),
      changeNote: row.changeNote,
      createdAt: row.createdAt,
    };
  }

  // ------------------------------------------------------------ komentar

  async createComment(input: NewArticleCommentInput): Promise<ArticleComment> {
    const [row] = await this.db
      .insert(articleComments)
      .values({
        articleId: input.articleId,
        userId: input.userId,
        body: input.body,
        bodyOriginal: input.bodyOriginal,
        imageUrl: input.imageUrl ?? null,
        createdAt: new Date(),
      })
      .returning();
    if (!row) throw new Error('gagal menyimpan komentar');
    const comment = await this.findCommentById(row.id);
    if (!comment) throw new Error('komentar tidak ditemukan setelah dibuat');
    return comment;
  }

  async findCommentById(id: string): Promise<ArticleComment | null> {
    const [row] = await this.db
      .select({
        c: articleComments,
        username: users.username,
        displayName: users.displayName,
        avatarUrl: users.avatarUrl,
        authorDeletedAt: users.deletedAt,
        userRole: highestUserRoleSql,
        isEdited: sql<boolean>`EXISTS (
          SELECT 1 FROM ${articleCommentRevisions}
          WHERE ${articleCommentRevisions.commentId} = ${articleComments.id}
        )`,
      })
      .from(articleComments)
      .leftJoin(users, eq(users.id, articleComments.userId))
      .where(eq(articleComments.id, id))
      .limit(1);
    if (!row) return null;
    return toComment(row.c, {
      username: row.username,
      displayName: row.displayName,
      avatarUrl: row.avatarUrl,
      userRole: row.userRole,
      authorDeletedAt: row.authorDeletedAt,
      isEdited: Boolean(row.isEdited),
    });
  }

  async listComments(
    articleId: string,
    filter: ArticleCommentListFilter,
  ): Promise<CursorPage<ArticleComment>> {
    const limit = filter.limit;
    const conditions = [eq(articleComments.articleId, articleId)];
    if (filter.status) conditions.push(eq(articleComments.status, filter.status));
    if (filter.cursor) conditions.push(lt(articleComments.id, filter.cursor));

    const rows = await this.db
      .select({
        c: articleComments,
        username: users.username,
        displayName: users.displayName,
        avatarUrl: users.avatarUrl,
        authorDeletedAt: users.deletedAt,
        userRole: highestUserRoleSql,
        isEdited: sql<boolean>`EXISTS (
          SELECT 1 FROM ${articleCommentRevisions}
          WHERE ${articleCommentRevisions.commentId} = ${articleComments.id}
        )`,
      })
      .from(articleComments)
      .leftJoin(users, eq(users.id, articleComments.userId))
      .where(and(...conditions))
      .orderBy(desc(articleComments.id))
      .limit(limit + 1);

    const hasMore = rows.length > limit;
    const page = hasMore ? rows.slice(0, limit) : rows;
    return {
      items: page.map((row) =>
        toComment(row.c, {
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
  }): Promise<ArticleComment | null> {
    const now = new Date();
    const updated = await this.db.transaction(async (tx) => {
      const [current] = await tx
        .select({ body: articleComments.body })
        .from(articleComments)
        .where(eq(articleComments.id, input.commentId))
        .limit(1);
      if (!current) return null;

      await tx.insert(articleCommentRevisions).values({
        commentId: input.commentId,
        editorId: input.editorId,
        body: current.body,
        createdAt: now,
      });
      const excess = await tx
        .select({ id: articleCommentRevisions.id })
        .from(articleCommentRevisions)
        .where(eq(articleCommentRevisions.commentId, input.commentId))
        .orderBy(desc(articleCommentRevisions.createdAt))
        .offset(COMMENT_REVISION_CAP);
      if (excess.length > 0) {
        await tx
          .delete(articleCommentRevisions)
          .where(inArray(articleCommentRevisions.id, excess.map((r) => r.id)));
      }

      const [row] = await tx
        .update(articleComments)
        .set({ body: input.body, updatedAt: now })
        .where(
          and(
            eq(articleComments.id, input.commentId),
            eq(articleComments.status, 'published'),
            eq(articleComments.userId, input.editorId),
          ),
        )
        .returning({ id: articleComments.id });
      return row?.id ?? null;
    });
    if (!updated) return null;
    return this.findCommentById(updated);
  }

  async markCommentDeletedByAuthor(id: string, actorId: string): Promise<boolean> {
    const [row] = await this.db
      .update(articleComments)
      .set({ status: 'deleted_by_author', deletedAt: new Date() })
      .where(
        and(
          eq(articleComments.id, id),
          eq(articleComments.userId, actorId),
          eq(articleComments.status, 'published'),
        ),
      )
      .returning({ id: articleComments.id });
    return Boolean(row);
  }

  async takedownComment(id: string, actorId: string): Promise<boolean> {
    const [row] = await this.db
      .update(articleComments)
      .set({
        status: 'taken_down',
        reviewedBy: actorId,
        reviewedAt: new Date(),
      })
      .where(and(eq(articleComments.id, id), eq(articleComments.status, 'published')))
      .returning({ id: articleComments.id });
    return Boolean(row);
  }

  async commentTargetExists(id: string): Promise<boolean> {
    const [row] = await this.db
      .select({ id: articleComments.id })
      .from(articleComments)
      .where(
        and(eq(articleComments.id, id), eq(articleComments.status, 'published')),
      )
      .limit(1);
    return Boolean(row);
  }

  async articleTargetExists(id: string): Promise<boolean> {
    const [row] = await this.db
      .select({ id: articles.id })
      .from(articles)
      .where(
        and(
          eq(articles.id, id),
          eq(articles.status, 'published'),
          sql`${articles.deletedAt} is null`,
        ),
      )
      .limit(1);
    return Boolean(row);
  }

  // ------------------------------------------------------------ bookmark

  async toggleBookmark(userId: string, articleId: string): Promise<boolean> {
    const existing = await this.db
      .select({ id: articleBookmarks.id })
      .from(articleBookmarks)
      .where(
        and(
          eq(articleBookmarks.userId, userId),
          eq(articleBookmarks.articleId, articleId),
        ),
      )
      .limit(1);
    if (existing.length > 0) {
      await this.db
        .delete(articleBookmarks)
        .where(eq(articleBookmarks.id, existing[0]!.id));
      return false;
    }
    await this.db
      .insert(articleBookmarks)
      .values({ userId, articleId, createdAt: new Date() })
      .onConflictDoNothing();
    return true;
  }

  async isBookmarked(userId: string, articleId: string): Promise<boolean> {
    const [row] = await this.db
      .select({ id: articleBookmarks.id })
      .from(articleBookmarks)
      .where(
        and(
          eq(articleBookmarks.userId, userId),
          eq(articleBookmarks.articleId, articleId),
        ),
      )
      .limit(1);
    return Boolean(row);
  }

  // --------------------------------------------------------- kontribusi

  async createContribution(
    input: NewArticleContributionInput,
  ): Promise<ArticleContribution> {
    const [row] = await this.db
      .insert(articleContributions)
      .values({
        userId: input.userId,
        kind: input.kind,
        articleId: input.articleId,
        payloadJson: JSON.stringify(input.payload),
        baseUpdatedAt: input.baseUpdatedAt,
        createdAt: new Date(),
      })
      .returning();
    if (!row) throw new Error('gagal menyimpan usulan');
    const found = await this.findContributionById(row.id);
    if (!found) throw new Error('usulan tidak ditemukan setelah dibuat');
    return found;
  }

  async findContributionById(id: string): Promise<ArticleContribution | null> {
    const [row] = await this.db
      .select({
        c: articleContributions,
        username: users.username,
        displayName: users.displayName,
        articleSlug: articles.slug,
        articleTitle: articles.title,
      })
      .from(articleContributions)
      .leftJoin(users, eq(users.id, articleContributions.userId))
      .leftJoin(articles, eq(articles.id, articleContributions.articleId))
      .where(eq(articleContributions.id, id))
      .limit(1);
    if (!row) return null;
    return toContribution(row.c, {
      username: row.username,
      displayName: row.displayName,
      articleSlug: row.articleSlug,
      articleTitle: row.articleTitle,
    });
  }

  async listContributions(
    filter: ContributionListFilter,
  ): Promise<CursorPage<ArticleContribution>> {
    const limit = filter.limit;
    const conditions: ReturnType<typeof eq>[] = [];
    if (filter.userId) conditions.push(eq(articleContributions.userId, filter.userId));
    if (filter.status) conditions.push(eq(articleContributions.status, filter.status));
    if (filter.cursor) conditions.push(lt(articleContributions.id, filter.cursor));

    const rows = await this.db
      .select({
        c: articleContributions,
        username: users.username,
        displayName: users.displayName,
        articleSlug: articles.slug,
        articleTitle: articles.title,
      })
      .from(articleContributions)
      .leftJoin(users, eq(users.id, articleContributions.userId))
      .leftJoin(articles, eq(articles.id, articleContributions.articleId))
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(articleContributions.id))
      .limit(limit + 1);

    const hasMore = rows.length > limit;
    const page = hasMore ? rows.slice(0, limit) : rows;
    return {
      items: page.map((row) =>
        toContribution(row.c, {
          username: row.username,
          displayName: row.displayName,
          articleSlug: row.articleSlug,
          articleTitle: row.articleTitle,
        }),
      ),
      nextCursor: hasMore ? (page[page.length - 1]?.c.id ?? null) : null,
      hasMore,
    };
  }

  async setContributionStatus(input: {
    id: string;
    status: 'pending' | 'needs_revision' | 'approved' | 'rejected';
    revisionNote?: string | null;
    rejectReasonCode?: string | null;
    rejectReasonText?: string | null;
    resultArticleId?: string | null;
  }): Promise<ArticleContribution | null> {
    const [row] = await this.db
      .update(articleContributions)
      .set({
        status: input.status,
        revisionNote: input.revisionNote ?? null,
        rejectReasonCode: input.rejectReasonCode ?? null,
        rejectReasonText: input.rejectReasonText ?? null,
        resultArticleId: input.resultArticleId ?? null,
        reviewedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(articleContributions.id, input.id))
      .returning({ id: articleContributions.id });
    if (!row) return null;
    return this.findContributionById(row.id);
  }

  async clearActiveEdit(articleId: string, userId: string): Promise<void> {
    // Index partial unik hanya menjaga status aktif; setelah approve/reject
    // baris tetap ada sebagai riwayat, jadi tidak perlu update apa pun.
    // Method dipertahankan untuk kejelasan alur use case.
    void articleId;
    void userId;
  }

  async hasActiveEditByOthers(articleId: string, userId: string): Promise<boolean> {
    const [row] = await this.db
      .select({ id: articleContributions.id })
      .from(articleContributions)
      .where(
        and(
          eq(articleContributions.articleId, articleId),
          eq(articleContributions.kind, 'edit'),
          sql`${articleContributions.status} in ('pending','needs_revision')`,
          sql`${articleContributions.userId} <> ${userId}`,
        ),
      )
      .limit(1);
    return Boolean(row);
  }
}

function toContribution(
  row: ContributionRow,
  extra: {
    username: string | null;
    displayName: string | null;
    articleSlug: string | null;
    articleTitle: string | null;
  },
): ArticleContribution {
  return {
    id: row.id,
    userId: row.userId,
    username: extra.username,
    displayName: extra.displayName,
    kind: row.kind as ArticleContributionKind,
    articleId: row.articleId,
    articleSlug: extra.articleSlug,
    articleTitle: extra.articleTitle,
    payload: toPayload(row.payloadJson),
    baseUpdatedAt: row.baseUpdatedAt,
    status: row.status as ArticleContributionStatus,
    resultArticleId: row.resultArticleId,
    revisionNote: row.revisionNote,
    rejectReasonCode: row.rejectReasonCode,
    rejectReasonText: row.rejectReasonText,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    reviewedAt: row.reviewedAt,
  };
}
