import type { Context } from 'hono';
import { UnauthorizedError } from '@/shared/errors/app-error';
import { isVerifierRole } from '@/modules/word/application/utils/resolve-publication';
import type { AppVariables, AuthUser } from '@/shared/types';
import type {
  Article,
  ArticleComment,
  ArticleContribution,
  ArticleRevision,
  EncyclopediaCategory,
  EncyclopediaTag,
} from '../../domain/entities/encyclopedia.entity';
import type {
  CreateArticleUseCase,
  GetArticleBySlugUseCase,
  ListArticleRevisionsUseCase,
  ListArticlesUseCase,
  ListEncyclopediaCategoriesUseCase,
  MergeTagUseCase,
  RestoreArticleRevisionUseCase,
  SearchArticlesUseCase,
  SetArticleStatusUseCase,
  UpdateArticleUseCase,
} from '../../application/use-cases/article.use-cases';
import type {
  CreateArticleCommentUseCase,
  DeleteArticleCommentUseCase,
  ListArticleCommentsUseCase,
  ListArticleContributionsUseCase,
  ListMyArticleContributionsUseCase,
  ResubmitArticleContributionUseCase,
  ReviewArticleContributionUseCase,
  SubmitArticleContributionUseCase,
  TakedownArticleCommentUseCase,
  ToggleArticleBookmarkUseCase,
  UpdateArticleCommentUseCase,
} from '../../application/use-cases/encyclopedia-contribution.use-cases';
import type { ArticleReportUseCases } from '../../application/use-cases/article-report.use-cases';
import type { ArticleRepository } from '../../domain/repositories/encyclopedia.repository';
import type {
  ListArticlesQuery,
  SearchArticlesQuery,
  SubmitContributionBody,
} from './validators/encyclopedia.validator';

function requireUser(c: Context<{ Variables: AppVariables }>): AuthUser {
  const user = c.get('user');
  if (!user) throw new UnauthorizedError();
  return user;
}

function publicName(username: string | null, displayName: string | null): string | null {
  return displayName ?? username;
}

function toArticleWire(a: Article, opts?: { bookmarked?: boolean | null }) {
  const authorDeleted = a.authorDeletedAt !== null;
  return {
    id: a.id,
    slug: a.slug,
    title: a.title,
    excerpt: a.excerpt,
    body_md: a.bodyMd,
    cover_url: a.coverUrl,
    category_id: a.categoryId,
    category: { id: a.categoryId, name: a.categoryName ?? a.categoryId },
    tags: a.tags,
    source_url: a.sourceUrl,
    references_md: a.referencesMd,
    author: {
      user_id: a.authorUserId,
      username: authorDeleted ? null : a.authorUsername,
      display_name: authorDeleted
        ? null
        : publicName(a.authorUsername, a.authorDisplayName),
      avatar_url: authorDeleted ? null : a.authorAvatarUrl,
      is_verifier: !authorDeleted && isVerifierRole(''),
    },
    status: a.status,
    published_at: a.publishedAt?.toISOString() ?? null,
    created_at: a.createdAt.toISOString(),
    updated_at: a.updatedAt?.toISOString() ?? null,
    /** null = tamu / tidak dicek; true/false = status bookmark user login. */
    bookmarked: opts?.bookmarked ?? null,
  };
}

function toArticleListItem(a: Article) {
  return {
    id: a.id,
    slug: a.slug,
    title: a.title,
    excerpt: a.excerpt,
    cover_url: a.coverUrl,
    category_id: a.categoryId,
    category: { id: a.categoryId, name: a.categoryName ?? a.categoryId },
    tags: a.tags,
    published_at: a.publishedAt?.toISOString() ?? null,
    created_at: a.createdAt.toISOString(),
    updated_at: a.updatedAt?.toISOString() ?? null,
  };
}

function toCommentWire(c: ArticleComment) {
  const deleted = c.authorDeletedAt !== null;
  return {
    id: c.id,
    article_id: c.articleId,
    user: {
      user_id: c.userId,
      username: deleted ? null : c.username,
      display_name: deleted ? null : publicName(c.username, c.displayName),
      avatar_url: deleted ? null : c.avatarUrl,
      is_verifier: !deleted && isVerifierRole(c.userRole ?? ''),
    },
    body: c.body,
    image_url: c.imageUrl,
    status: c.status,
    is_edited: c.isEdited,
    created_at: c.createdAt.toISOString(),
    updated_at: c.updatedAt?.toISOString() ?? null,
  };
}

function toContributionWire(c: ArticleContribution) {
  return {
    id: c.id,
    kind: c.kind,
    status: c.status,
    article_id: c.articleId,
    article: c.articleId
      ? { id: c.articleId, slug: c.articleSlug, title: c.articleTitle }
      : null,
    payload: c.payload,
    base_updated_at: c.baseUpdatedAt?.toISOString() ?? null,
    revision_note: c.revisionNote,
    reject_reason_code: c.rejectReasonCode,
    reject_reason_text: c.rejectReasonText,
    result_article_id: c.resultArticleId,
    created_at: c.createdAt.toISOString(),
    updated_at: c.updatedAt?.toISOString() ?? null,
    reviewed_at: c.reviewedAt?.toISOString() ?? null,
  };
}

function toRevisionWire(r: ArticleRevision) {
  return {
    id: r.id,
    article_id: r.articleId,
    editor_id: r.editorId,
    editor_username: r.editorUsername,
    contribution_id: r.contributionId,
    title: r.title,
    excerpt: r.excerpt,
    body_md: r.bodyMd,
    category_id: r.categoryId,
    tags: r.tags,
    change_note: r.changeNote,
    created_at: r.createdAt.toISOString(),
  };
}

function toCategoryWire(c: EncyclopediaCategory) {
  return { id: c.id, name: c.name, status: c.status, sort_order: c.sortOrder };
}

function toTagWire(t: EncyclopediaTag) {
  return { id: t.id, slug: t.slug, name: t.name };
}

export interface EncyclopediaControllerDeps {
  repo: ArticleRepository;
  listArticles: ListArticlesUseCase;
  getArticle: GetArticleBySlugUseCase;
  searchArticles: SearchArticlesUseCase;
  listCategories: ListEncyclopediaCategoriesUseCase;
  createArticle: CreateArticleUseCase;
  updateArticle: UpdateArticleUseCase;
  setStatus: SetArticleStatusUseCase;
  listRevisions: ListArticleRevisionsUseCase;
  restoreRevision: RestoreArticleRevisionUseCase;
  mergeTag: MergeTagUseCase;
  listComments: ListArticleCommentsUseCase;
  createComment: CreateArticleCommentUseCase;
  updateComment: UpdateArticleCommentUseCase;
  deleteComment: DeleteArticleCommentUseCase;
  takedownComment: TakedownArticleCommentUseCase;
  toggleBookmark: ToggleArticleBookmarkUseCase;
  submitContribution: SubmitArticleContributionUseCase;
  resubmitContribution: ResubmitArticleContributionUseCase;
  listMyContributions: ListMyArticleContributionsUseCase;
  listContributions: ListArticleContributionsUseCase;
  reviewContribution: ReviewArticleContributionUseCase;
  reports: ArticleReportUseCases;
}

export class EncyclopediaController {
  constructor(private readonly deps: EncyclopediaControllerDeps) {}

  // -------------------------------------------------------------- publik

  async list(c: Context<{ Variables: AppVariables }>) {
    const q = c.req.valid('query' as never) as ListArticlesQuery;
    const page = await this.deps.listArticles.execute({
      categoryId: q.category_id,
      tags: q.tag,
      q: q.q,
      cursor: q.cursor,
      limit: q.limit,
    });
    return c.json({
      success: true as const,
      data: {
        items: page.items.map(toArticleListItem),
        next_cursor: page.nextCursor,
        has_more: page.hasMore,
      },
    });
  }

  async search(c: Context<{ Variables: AppVariables }>) {
    const q = c.req.valid('query' as never) as SearchArticlesQuery;
    const items = await this.deps.searchArticles.execute(q.q, q.limit);
    return c.json({
      success: true as const,
      data: { items: items.map(toArticleListItem) },
    });
  }

  async detail(c: Context<{ Variables: AppVariables }>) {
    const { slug } = c.req.valid('param' as never) as { slug: string };
    const article = await this.deps.getArticle.execute(slug);
    const user = c.get('user');
    const bookmarked = user
      ? await this.deps.repo.isBookmarked(user.user_id, article.id)
      : null;
    return c.json({
      success: true as const,
      data: toArticleWire(article, { bookmarked }),
    });
  }

  async categories(c: Context<{ Variables: AppVariables }>) {
    const items = await this.deps.listCategories.execute();
    return c.json({
      success: true as const,
      data: {
        items: items
          .filter((cat) => cat.status === 'published')
          .map(toCategoryWire),
      },
    });
  }

  async tags(c: Context<{ Variables: AppVariables }>) {
    const q = c.req.valid('query' as never) as { q?: string; limit: number };
    const items = await this.deps.repo.listTags(q.q, q.limit);
    return c.json({
      success: true as const,
      data: { items: items.map(toTagWire) },
    });
  }

  // ------------------------------------------------------------ komentar

  async listComments(c: Context<{ Variables: AppVariables }>) {
    const { id } = c.req.valid('param' as never) as { id: string };
    const q = c.req.valid('query' as never) as { cursor?: string; limit: number };
    const page = await this.deps.listComments.execute(id, q.cursor, q.limit);
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
    const body = c.req.valid('json' as never) as {
      body: string;
      image_url?: string | null;
    };
    const comment = await this.deps.createComment.execute({
      articleId: id,
      userId: user.user_id,
      body: body.body,
      imageUrl: body.image_url ?? null,
      requestId: c.get('requestId') ?? null,
    });
    return c.json({ success: true as const, data: toCommentWire(comment) }, 201);
  }

  async updateComment(c: Context<{ Variables: AppVariables }>) {
    const user = requireUser(c);
    const { id } = c.req.valid('param' as never) as { id: string };
    const body = c.req.valid('json' as never) as { body: string };
    const updated = await this.deps.updateComment.execute({
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
    await this.deps.deleteComment.execute(id, user.user_id);
    return c.json({ success: true as const, data: { deleted: true } });
  }

  async takedownComment(c: Context<{ Variables: AppVariables }>) {
    const user = requireUser(c);
    const { id } = c.req.valid('param' as never) as { id: string };
    await this.deps.takedownComment.execute(id, user.user_id);
    return c.json({ success: true as const, data: { taken_down: true } });
  }

  async toggleBookmark(c: Context<{ Variables: AppVariables }>) {
    const user = requireUser(c);
    const { id } = c.req.valid('param' as never) as { id: string };
    const bookmarked = await this.deps.toggleBookmark.execute(user.user_id, id);
    return c.json({ success: true as const, data: { bookmarked } });
  }

  // ---------------------------------------------------------- kontribusi

  async submitContribution(c: Context<{ Variables: AppVariables }>) {
    const user = requireUser(c);
    const body = c.req.valid('json' as never) as SubmitContributionBody;
    const created = await this.deps.submitContribution.execute({
      userId: user.user_id,
      kind: body.kind,
      articleId: body.article_id ?? null,
      payload: {
        title: body.title,
        excerpt: body.excerpt,
        body_md: body.body_md,
        category_id: body.category_id,
        tags: body.tags,
        cover_url: body.cover_url ?? null,
        source_url: body.source_url ?? null,
        references_md: body.references_md ?? null,
      },
      requestId: c.get('requestId') ?? null,
    });
    return c.json({ success: true as const, data: toContributionWire(created) }, 201);
  }

  async resubmitContribution(c: Context<{ Variables: AppVariables }>) {
    const user = requireUser(c);
    const { id } = c.req.valid('param' as never) as { id: string };
    const body = c.req.valid('json' as never) as SubmitContributionBody;
    const created = await this.deps.resubmitContribution.execute({
      contributionId: id,
      userId: user.user_id,
      payload: {
        title: body.title,
        excerpt: body.excerpt,
        body_md: body.body_md,
        category_id: body.category_id,
        tags: body.tags,
        cover_url: body.cover_url ?? null,
        source_url: body.source_url ?? null,
        references_md: body.references_md ?? null,
      },
      requestId: c.get('requestId') ?? null,
    });
    return c.json({ success: true as const, data: toContributionWire(created) }, 201);
  }

  async myContributions(c: Context<{ Variables: AppVariables }>) {
    const user = requireUser(c);
    const q = c.req.valid('query' as never) as { cursor?: string; limit: number };
    const page = await this.deps.listMyContributions.execute(
      user.user_id,
      q.cursor,
      q.limit,
    );
    return c.json({
      success: true as const,
      data: {
        items: page.items.map(toContributionWire),
        next_cursor: page.nextCursor,
        has_more: page.hasMore,
      },
    });
  }

  // ------------------------------------------------------------- laporan

  async submitReport(c: Context<{ Variables: AppVariables }>) {
    const user = requireUser(c);
    const body = c.req.valid('json' as never) as {
      target_type: 'article' | 'article_comment';
      target_id: string;
      reason_code: string;
      note?: string | null;
    };
    const report = await this.deps.reports.submit({
      userId: user.user_id,
      targetType: body.target_type,
      targetId: body.target_id,
      reasonCode: body.reason_code as never,
      note: body.note ?? null,
      requestId: c.get('requestId') ?? null,
    });
    return c.json({ success: true as const, data: report }, 201);
  }

  // --------------------------------------------------------------- admin

  async adminListArticles(c: Context<{ Variables: AppVariables }>) {
    const q = c.req.valid('query' as never) as {
      status?: 'draft' | 'published' | 'archived';
      category_id?: string;
      q?: string;
      cursor?: string;
      limit: number;
    };
    const page = await this.deps.repo.list({
      categoryId: q.category_id,
      q: q.q,
      cursor: q.cursor,
      limit: q.limit,
    });
    // Admin melihat semua status: filter status di sisi aplikasi (halaman kecil).
    const items = q.status
      ? page.items.filter((item) => item.status === q.status)
      : page.items;
    return c.json({
      success: true as const,
      data: {
        items: items.map(toArticleWire),
        next_cursor: page.nextCursor,
        has_more: page.hasMore,
      },
    });
  }

  async adminCreateArticle(c: Context<{ Variables: AppVariables }>) {
    const user = requireUser(c);
    const body = c.req.valid('json' as never) as {
      slug?: string;
      title: string;
      excerpt: string;
      body_md: string;
      category_id: string;
      tags: string[];
      cover_url?: string | null;
      source_url?: string | null;
      references_md?: string | null;
      status: 'draft' | 'published';
    };
    const created = await this.deps.createArticle.execute({
      slug: body.slug,
      title: body.title,
      excerpt: body.excerpt,
      bodyMd: body.body_md,
      categoryId: body.category_id,
      tags: body.tags,
      coverUrl: body.cover_url ?? null,
      sourceUrl: body.source_url ?? null,
      referencesMd: body.references_md ?? null,
      authorUserId: user.user_id,
      status: body.status,
      requestId: c.get('requestId') ?? null,
    });
    return c.json({ success: true as const, data: toArticleWire(created) }, 201);
  }

  async adminUpdateArticle(c: Context<{ Variables: AppVariables }>) {
    const user = requireUser(c);
    const { id } = c.req.valid('param' as never) as { id: string };
    const body = c.req.valid('json' as never) as {
      title: string;
      excerpt: string;
      body_md: string;
      category_id: string;
      tags: string[];
      cover_url?: string | null;
      source_url?: string | null;
      references_md?: string | null;
      status?: 'draft' | 'published' | 'archived';
      change_note?: string | null;
    };
    const updated = await this.deps.updateArticle.execute(id, {
      title: body.title,
      excerpt: body.excerpt,
      bodyMd: body.body_md,
      categoryId: body.category_id,
      tags: body.tags,
      coverUrl: body.cover_url ?? null,
      sourceUrl: body.source_url ?? null,
      referencesMd: body.references_md ?? null,
      editorId: user.user_id,
      changeNote: body.change_note ?? null,
      requestId: c.get('requestId') ?? null,
    });
    const final =
      body.status && body.status !== updated.status
        ? await this.deps.setStatus.execute(
            id,
            body.status,
            user.user_id,
            c.get('requestId') ?? null,
          )
        : updated;
    return c.json({ success: true as const, data: toArticleWire(final) });
  }

  async adminDeleteArticle(c: Context<{ Variables: AppVariables }>) {
    const user = requireUser(c);
    const { id } = c.req.valid('param' as never) as { id: string };
    const article = await this.deps.repo.findById(id);
    if (!article) {
      return c.json(
        {
          success: false as const,
          error_code: 'ARTICLE_NOT_FOUND',
          message: 'Artikel tidak ditemukan',
          details: null,
        },
        404,
      );
    }
    await this.deps.setStatus.execute(id, 'archived', user.user_id);
    await this.deps.repo.markDeleted(id);
    return c.json({ success: true as const, data: { deleted: true } });
  }

  async adminListRevisions(c: Context<{ Variables: AppVariables }>) {
    const { id } = c.req.valid('param' as never) as { id: string };
    const items = await this.deps.listRevisions.execute(id);
    return c.json({
      success: true as const,
      data: { items: items.map(toRevisionWire) },
    });
  }

  async adminRestoreRevision(c: Context<{ Variables: AppVariables }>) {
    const user = requireUser(c);
    const { id, revisionId } = c.req.valid('param' as never) as {
      id: string;
      revisionId: string;
    };
    const article = await this.deps.restoreRevision.execute(
      id,
      revisionId,
      user.user_id,
      c.get('requestId') ?? null,
    );
    return c.json({ success: true as const, data: toArticleWire(article) });
  }

  async adminCreateCategory(c: Context<{ Variables: AppVariables }>) {
    const body = c.req.valid('json' as never) as {
      id: string;
      name: string;
      sort_order: number;
    };
    const created = await this.deps.repo.createCategory({
      id: body.id,
      name: body.name,
      sortOrder: body.sort_order,
    });
    return c.json({ success: true as const, data: toCategoryWire(created) }, 201);
  }

  async adminUpdateCategory(c: Context<{ Variables: AppVariables }>) {
    const { id } = c.req.valid('param' as never) as { id: string };
    const body = c.req.valid('json' as never) as {
      name?: string;
      status?: string;
      sort_order?: number;
    };
    const updated = await this.deps.repo.updateCategory(id, {
      ...(body.name !== undefined ? { name: body.name } : {}),
      ...(body.status !== undefined
        ? { status: body.status as 'draft' | 'published' | 'archived' }
        : {}),
      ...(body.sort_order !== undefined ? { sortOrder: body.sort_order } : {}),
    });
    if (!updated) {
      return c.json(
        {
          success: false as const,
          error_code: 'CATEGORY_NOT_FOUND',
          message: 'Kategori tidak ditemukan',
          details: null,
        },
        404,
      );
    }
    return c.json({ success: true as const, data: toCategoryWire(updated) });
  }

  async adminRenameTag(c: Context<{ Variables: AppVariables }>) {
    const { id } = c.req.valid('param' as never) as { id: string };
    const body = c.req.valid('json' as never) as { name: string };
    const updated = await this.deps.repo.renameTag(id, body.name);
    if (!updated) {
      return c.json(
        {
          success: false as const,
          error_code: 'TAG_NOT_FOUND',
          message: 'Tag tidak ditemukan',
          details: null,
        },
        404,
      );
    }
    return c.json({ success: true as const, data: toTagWire(updated) });
  }

  async adminMergeTag(c: Context<{ Variables: AppVariables }>) {
    const body = c.req.valid('json' as never) as {
      from_tag_id: string;
      into_tag_id: string;
    };
    await this.deps.mergeTag.execute(body.from_tag_id, body.into_tag_id);
    return c.json({ success: true as const, data: { merged: true } });
  }

  async adminListContributions(c: Context<{ Variables: AppVariables }>) {
    const q = c.req.valid('query' as never) as {
      status?: 'pending' | 'needs_revision' | 'approved' | 'rejected';
      cursor?: string;
      limit: number;
    };
    const page = await this.deps.listContributions.execute(
      q.status,
      q.cursor,
      q.limit,
    );
    return c.json({
      success: true as const,
      data: {
        items: page.items.map(toContributionWire),
        next_cursor: page.nextCursor,
        has_more: page.hasMore,
      },
    });
  }

  async adminReviewContribution(c: Context<{ Variables: AppVariables }>) {
    const user = requireUser(c);
    const { id } = c.req.valid('param' as never) as { id: string };
    const body = c.req.valid('json' as never) as {
      decision: 'approve' | 'needs_revision' | 'reject';
      revision_note?: string | null;
      reject_reason_code?: string | null;
      reject_reason_text?: string | null;
    };
    const reviewed = await this.deps.reviewContribution.execute({
      contributionId: id,
      decision: body.decision,
      reviewerId: user.user_id,
      revisionNote: body.revision_note ?? null,
      rejectReasonCode: body.reject_reason_code ?? null,
      rejectReasonText: body.reject_reason_text ?? null,
      requestId: c.get('requestId') ?? null,
    });
    return c.json({ success: true as const, data: toContributionWire(reviewed) });
  }

  async adminListReports(c: Context<{ Variables: AppVariables }>) {
    const q = c.req.valid('query' as never) as {
      status?: 'open' | 'resolved' | 'dismissed';
      cursor?: string;
      limit: number;
    };
    const page = await this.deps.reports.list(q.status, q.cursor, q.limit);
    return c.json({ success: true as const, data: page });
  }

  async adminResolveReport(c: Context<{ Variables: AppVariables }>) {
    const user = requireUser(c);
    const { id } = c.req.valid('param' as never) as { id: string };
    const body = c.req.valid('json' as never) as {
      resolution: 'dismissed' | 'taken_down';
      note?: string | null;
    };
    const report = await this.deps.reports.resolve({
      reportId: id,
      actorId: user.user_id,
      resolution: body.resolution,
      resolutionNote: body.note ?? null,
    });
    return c.json({ success: true as const, data: report });
  }
}
