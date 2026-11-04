import {
  BadRequestError,
  ConflictError,
  NotFoundError,
} from '@/shared/errors/app-error';
import type { AuditLogRepository } from '@/modules/audit/domain/repositories/audit-log.repository';
import type { RecordActivityEventUseCase } from '@/modules/activity/application/use-cases/record-activity-event.use-case';
import type {
  Article,
  ArticlePayload,
  EncyclopediaCategory,
} from '../../domain/entities/encyclopedia.entity';
import type {
  ArticleListFilter,
  ArticleRepository,
} from '../../domain/repositories/encyclopedia.repository';
import {
  extractImageUrls,
  isAllowedImageUrl,
  slugifyArticle,
  stripMarkdown,
} from '../utils/article.utils';
import type { CursorPage } from '@/modules/word/domain/repositories/word.repository';

export interface CreateArticleInput {
  slug?: string;
  title: string;
  excerpt: string;
  bodyMd: string;
  categoryId: string;
  tags: string[];
  coverUrl?: string | null;
  sourceUrl?: string | null;
  referencesMd?: string | null;
  authorUserId: string;
  status: 'draft' | 'published';
  requestId?: string | null;
}

export interface UpdateArticleInput {
  title: string;
  excerpt: string;
  bodyMd: string;
  categoryId: string;
  tags: string[];
  coverUrl?: string | null;
  sourceUrl?: string | null;
  referencesMd?: string | null;
  editorId: string;
  changeNote?: string | null;
  contributionId?: string | null;
  requestId?: string | null;
}

/** Validasi payload artikel (dipakai create admin + approve usulan). */
export function validateArticlePayload(payload: ArticlePayload): void {
  if (payload.cover_url && !isAllowedImageUrl(payload.cover_url)) {
    throw new BadRequestError(
      'IMAGE_URL_NOT_ALLOWED',
      'URL gambar sampul tidak didukung. Unggah lewat tombol unggah gambar.',
      [{ field: 'cover_url', message: 'URL gambar sampul tidak valid' }],
    );
  }
  for (const url of extractImageUrls(payload.body_md)) {
    if (!isAllowedImageUrl(url)) {
      throw new BadRequestError(
        'IMAGE_URL_NOT_ALLOWED',
        'Ada gambar di isi artikel yang berasal dari luar. Unggah lewat tombol unggah gambar.',
        [{ field: 'body_md', message: 'Ada URL gambar yang tidak didukung' }],
      );
    }
  }
}

/** Slug unik: kandidat base-2..20 dicek satu query; fallback timestamp. */
async function uniqueSlug(
  repo: ArticleRepository,
  title: string,
  explicit?: string,
): Promise<string> {
  const base = slugifyArticle(explicit?.trim() || title);
  const candidates = [base];
  for (let i = 2; i <= 20; i++) candidates.push(`${base}-${i}`);
  const taken = new Set<string>();
  for (const slug of candidates) {
    if ((await repo.findBySlug(slug)) !== null) taken.add(slug);
  }
  for (const slug of candidates) {
    if (!taken.has(slug)) return slug;
  }
  return `${base}-${Date.now()}`;
}

export class ListArticlesUseCase {
  constructor(private readonly repo: ArticleRepository) {}
  async execute(filter: ArticleListFilter): Promise<CursorPage<Article>> {
    return this.repo.list({ ...filter, status: 'published' });
  }
}

export class GetArticleBySlugUseCase {
  constructor(private readonly repo: ArticleRepository) {}
  async execute(slug: string): Promise<Article> {
    const article = await this.repo.findBySlug(slug);
    if (!article || article.status !== 'published') {
      throw new NotFoundError(
        'ARTICLE_NOT_FOUND',
        'Artikel tidak ditemukan atau sudah tidak tayang',
      );
    }
    return article;
  }
}

export class ListEncyclopediaCategoriesUseCase {
  constructor(private readonly repo: ArticleRepository) {}
  async execute(): Promise<EncyclopediaCategory[]> {
    return this.repo.listCategories();
  }
}

export class CreateArticleUseCase {
  constructor(
    private readonly repo: ArticleRepository,
    private readonly auditRepo: AuditLogRepository,
    private readonly activityEvents: RecordActivityEventUseCase | undefined = undefined,
  ) {}

  async execute(input: CreateArticleInput): Promise<Article> {
    validateArticlePayload({
      title: input.title,
      excerpt: input.excerpt,
      body_md: input.bodyMd,
      category_id: input.categoryId,
      tags: input.tags,
      cover_url: input.coverUrl ?? null,
      source_url: input.sourceUrl ?? null,
      references_md: input.referencesMd ?? null,
    });
    const categories = await this.repo.listCategories();
    if (!categories.some((c) => c.id === input.categoryId && c.status === 'published')) {
      throw new BadRequestError(
        'CATEGORY_NOT_FOUND',
        'Kategori artikel tidak ditemukan',
        [{ field: 'category_id', message: 'Pilih kategori yang valid' }],
      );
    }
    const slug = await uniqueSlug(this.repo, input.title, input.slug);
    const created = await this.repo.create({
      slug,
      title: input.title,
      excerpt: input.excerpt,
      bodyMd: input.bodyMd,
      bodyText: stripMarkdown(input.bodyMd),
      categoryId: input.categoryId,
      tags: input.tags,
      coverUrl: input.coverUrl ?? null,
      sourceUrl: input.sourceUrl ?? null,
      referencesMd: input.referencesMd ?? null,
      authorUserId: input.authorUserId,
      status: input.status,
    });
    await this.auditRepo.record({
      userId: input.authorUserId,
      action: 'create',
      entityType: 'article',
      entityId: created.id,
      newData: { slug: created.slug, title: created.title, status: created.status },
      requestId: input.requestId ?? null,
    });
    if (created.status === 'published') {
      await this.activityEvents?.safe({
        kind: 'article_published',
        actorId: created.authorUserId,
        targetId: created.id,
        dedupeKey: `article:${created.id}`,
        payload: `"${created.title}" sudah tayang`,
      });
    }
    return created;
  }
}

export class UpdateArticleUseCase {
  private readonly activityEvents?: RecordActivityEventUseCase;
  constructor(
    private readonly repo: ArticleRepository,
    private readonly auditRepo: AuditLogRepository,
    activityEvents?: RecordActivityEventUseCase,
  ) {
    // Disimpan tapi tidak dipakai di update: event publish artikel
    // ditangani SetArticleStatusUseCase (momennya di situ).
    this.activityEvents = activityEvents;
    void this.activityEvents;
  }

  async execute(articleId: string, input: UpdateArticleInput): Promise<Article> {
    const existing = await this.repo.findById(articleId);
    if (!existing) {
      throw new NotFoundError('ARTICLE_NOT_FOUND', 'Artikel tidak ditemukan');
    }
    // Slug immutable setelah publish: tidak ada redirect tracking di repo.
    if (existing.status === 'published') {
      validateArticlePayload({
        title: input.title,
        excerpt: input.excerpt,
        body_md: input.bodyMd,
        category_id: input.categoryId,
        tags: input.tags,
        cover_url: input.coverUrl ?? null,
        source_url: input.sourceUrl ?? null,
        references_md: input.referencesMd ?? null,
      });
    }
    const categories = await this.repo.listCategories();
    if (!categories.some((c) => c.id === input.categoryId && c.status === 'published')) {
      throw new BadRequestError(
        'CATEGORY_NOT_FOUND',
        'Kategori artikel tidak ditemukan',
        [{ field: 'category_id', message: 'Pilih kategori yang valid' }],
      );
    }

    const unchanged =
      existing.title === input.title &&
      existing.excerpt === input.excerpt &&
      existing.bodyMd === input.bodyMd &&
      existing.categoryId === input.categoryId &&
      JSON.stringify([...existing.tags].sort()) ===
        JSON.stringify([...input.tags].sort());
    if (unchanged) {
      // Edit tanpa perubahan tidak menulis revisi (keputusan plan).
      return existing;
    }

    const updated = await this.repo.updateWithRevision({
      id: articleId,
      patch: {
        title: input.title,
        excerpt: input.excerpt,
        bodyMd: input.bodyMd,
        bodyText: stripMarkdown(input.bodyMd),
        categoryId: input.categoryId,
        tags: input.tags,
        coverUrl: input.coverUrl ?? null,
        sourceUrl: input.sourceUrl ?? null,
        referencesMd: input.referencesMd ?? null,
      },
      revision: {
        articleId,
        editorId: input.editorId,
        contributionId: input.contributionId ?? null,
        previous: {
          title: existing.title,
          excerpt: existing.excerpt,
          bodyMd: existing.bodyMd,
          categoryId: existing.categoryId,
          tags: existing.tags,
        },
        changeNote: input.changeNote ?? null,
      },
    });
    if (!updated) {
      throw new NotFoundError('ARTICLE_NOT_FOUND', 'Artikel tidak ditemukan');
    }
    await this.auditRepo.record({
      userId: input.editorId,
      action: 'update',
      entityType: 'article',
      entityId: articleId,
      oldData: {
        title: existing.title,
        excerpt: existing.excerpt,
        body_md_len: existing.bodyMd.length,
        category_id: existing.categoryId,
        tags: existing.tags,
      },
      newData: {
        title: updated.title,
        excerpt: updated.excerpt,
        body_md_len: updated.bodyMd.length,
        category_id: updated.categoryId,
        tags: updated.tags,
      },
      requestId: input.requestId ?? null,
    });
    return updated;
  }
}

export class SetArticleStatusUseCase {
  constructor(
    private readonly repo: ArticleRepository,
    private readonly auditRepo: AuditLogRepository,
    private readonly activityEvents: RecordActivityEventUseCase | undefined = undefined,
  ) {}

  async execute(
    articleId: string,
    status: 'draft' | 'published' | 'archived',
    actorId: string,
    requestId?: string | null,
  ): Promise<Article> {
    const existing = await this.repo.findById(articleId);
    if (!existing) {
      throw new NotFoundError('ARTICLE_NOT_FOUND', 'Artikel tidak ditemukan');
    }
    const updated = await this.repo.setStatus(articleId, status, actorId);
    if (!updated) {
      throw new NotFoundError('ARTICLE_NOT_FOUND', 'Artikel tidak ditemukan');
    }
    await this.auditRepo.record({
      userId: actorId,
      action: `status:${status}`,
      entityType: 'article',
      entityId: articleId,
      oldData: { status: existing.status },
      newData: { status },
      requestId: requestId ?? null,
    });
    if (status === 'published' && existing.status !== 'published') {
      await this.activityEvents?.safe({
        kind: 'article_published',
        actorId: updated.authorUserId,
        targetId: updated.id,
        dedupeKey: `article:${updated.id}`,
        payload: `"${updated.title}" sudah tayang`,
      });
    }
    return updated;
  }
}

export class RestoreArticleRevisionUseCase {
  constructor(
    private readonly repo: ArticleRepository,
    private readonly auditRepo: AuditLogRepository,
  ) {}

  async execute(
    articleId: string,
    revisionId: string,
    editorId: string,
    requestId?: string | null,
  ): Promise<Article> {
    const revision = await this.repo.findRevision(articleId, revisionId);
    if (!revision) {
      throw new NotFoundError('ARTICLE_REVISION_NOT_FOUND', 'Versi artikel tidak ditemukan');
    }
    const updater = new UpdateArticleUseCase(this.repo, this.auditRepo);
    return updater.execute(articleId, {
      title: revision.title,
      excerpt: revision.excerpt,
      bodyMd: revision.bodyMd,
      categoryId: revision.categoryId,
      tags: revision.tags,
      editorId,
      changeNote: `Pulihkan versi ${revision.createdAt.toISOString()}`,
      requestId: requestId ?? null,
    });
  }
}

export class ListArticleRevisionsUseCase {
  constructor(private readonly repo: ArticleRepository) {}
  async execute(articleId: string) {
    const article = await this.repo.findById(articleId);
    if (!article) {
      throw new NotFoundError('ARTICLE_NOT_FOUND', 'Artikel tidak ditemukan');
    }
    return this.repo.listRevisions(articleId);
  }
}

export class SearchArticlesUseCase {
  constructor(private readonly repo: ArticleRepository) {}
  async execute(q: string, limit: number): Promise<Article[]> {
    return this.repo.searchPublished(q, limit);
  }
}

export class MergeTagUseCase {
  constructor(private readonly repo: ArticleRepository) {}
  async execute(fromTagId: string, intoTagId: string): Promise<void> {
    if (fromTagId === intoTagId) {
      throw new BadRequestError(
        'TAG_MERGE_SAME',
        'Tag sumber dan tag tujuan tidak boleh sama',
      );
    }
    await this.repo.mergeTag(fromTagId, intoTagId);
  }
}

export { ConflictError };
