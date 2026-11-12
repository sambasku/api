import {
  BadRequestError,
  ConflictError,
  ForbiddenError,
  NotFoundError,
} from '@/shared/errors/app-error';
import type { AuditLogRepository } from '@/modules/audit/domain/repositories/audit-log.repository';
import type { CommentBlocklistRepository } from '@/modules/comment-blocklist/domain/repositories/comment-blocklist.repository';
import { applyBlocklistFilter } from '@/modules/comment-blocklist/application/utils/apply-blocklist-filter';
import { assertCanContribute } from '@/modules/word/application/utils/assert-can-contribute';
import { assertUgcTextQualityWithStrike } from '@/shared/moderation/assert-ugc-text-quality-with-strike';
import type { RecordAbuseSignalUseCase } from '@/shared/moderation/record-abuse-signal.use-case';
import type { RecordActivityEventUseCase } from '@/modules/activity/application/use-cases/record-activity-event.use-case';
import type {
  ArticleComment,
  ArticleContribution,
} from '../../domain/entities/encyclopedia.entity';
import type {
  ArticleRepository,
  NewArticleContributionInput,
} from '../../domain/repositories/encyclopedia.repository';
import type { CursorPage } from '@/modules/word/domain/repositories/word.repository';
import { validateArticlePayload } from './article.use-cases';

// ---------------------------------------------------------------- komentar

export interface CreateCommentInput {
  articleId: string;
  userId: string;
  body: string;
  imageUrl?: string | null;
  requestId?: string | null;
}

export class ListArticleCommentsUseCase {
  constructor(private readonly repo: ArticleRepository) {}
  async execute(
    articleId: string,
    cursor: string | undefined,
    limit: number,
  ): Promise<CursorPage<ArticleComment>> {
    return this.repo.listComments(articleId, {
      status: 'published',
      cursor,
      limit,
    });
  }
}

export class CreateArticleCommentUseCase {
  constructor(
    private readonly repo: ArticleRepository,
    private readonly auditRepo: AuditLogRepository,
    private readonly blocklistRepo: CommentBlocklistRepository,
    private readonly abuse?: RecordAbuseSignalUseCase,
    private readonly activityEvents?: RecordActivityEventUseCase,
  ) {}

  async execute(input: CreateCommentInput): Promise<ArticleComment> {
    await assertCanContribute(input.userId);
    const article = await this.repo.findById(input.articleId);
    if (!article || article.status !== 'published') {
      throw new NotFoundError(
        'ARTICLE_NOT_FOUND',
        'Artikel tidak ditemukan atau sudah tidak tayang',
      );
    }
    const body = input.body.trim();
    if (body.length === 0 || body.length > 1000) {
      throw new BadRequestError('VALIDATION_ERROR', 'Komentar 1-1000 karakter', [
        { field: 'body', message: 'Komentar antara 1 sampai 1000 karakter' },
      ]);
    }
    await assertUgcTextQualityWithStrike(body, {
      userId: input.userId,
      abuse: this.abuse,
      entityType: 'article_comment',
      requestId: input.requestId,
    });
    const blocked = await this.blocklistRepo.listAllActiveWords();
    const filtered = applyBlocklistFilter(body, blocked);
    const created = await this.repo.createComment({
      articleId: input.articleId,
      userId: input.userId,
      body: filtered,
      bodyOriginal: filtered !== body ? body : null,
      imageUrl: input.imageUrl ?? null,
    });
    await this.auditRepo.record({
      userId: input.userId,
      action: 'create',
      entityType: 'article_comment',
      entityId: created.id,
      newData: { article_id: article.id },
      requestId: input.requestId ?? null,
    });
    await this.activityEvents?.safe({
      kind: 'article_comment_created',
      actorId: input.userId,
      targetId: created.id,
      dedupeKey: `article_comment:${created.id}`,
    });
    return created;
  }
}

export class UpdateArticleCommentUseCase {
  constructor(
    private readonly repo: ArticleRepository,
    private readonly auditRepo: AuditLogRepository,
    private readonly blocklistRepo: CommentBlocklistRepository,
    private readonly abuse?: RecordAbuseSignalUseCase,
  ) {}

  async execute(input: {
    commentId: string;
    userId: string;
    body: string;
    requestId?: string | null;
  }): Promise<ArticleComment> {
    await assertCanContribute(input.userId);
    const existing = await this.repo.findCommentById(input.commentId);
    if (!existing || existing.status !== 'published') {
      throw new NotFoundError('COMMENT_NOT_FOUND', 'Komentar tidak ditemukan');
    }
    if (existing.userId !== input.userId) {
      throw new ForbiddenError('COMMENT_NOT_OWNER', 'Kamu hanya bisa mengubah komentar sendiri');
    }
    const body = input.body.trim();
    if (body.length === 0 || body.length > 1000) {
      throw new BadRequestError('VALIDATION_ERROR', 'Komentar 1-1000 karakter', [
        { field: 'body', message: 'Komentar antara 1 sampai 1000 karakter' },
      ]);
    }
    await assertUgcTextQualityWithStrike(body, {
      userId: input.userId,
      abuse: this.abuse,
      entityType: 'article_comment',
      requestId: input.requestId,
    });
    const blocked = await this.blocklistRepo.listAllActiveWords();
    const filtered = applyBlocklistFilter(body, blocked);
    const updated = await this.repo.updateCommentWithRevision({
      commentId: input.commentId,
      editorId: input.userId,
      body: filtered,
    });
    if (!updated) {
      throw new NotFoundError('COMMENT_NOT_FOUND', 'Komentar tidak ditemukan');
    }
    await this.auditRepo.record({
      userId: input.userId,
      action: 'update',
      entityType: 'article_comment',
      entityId: input.commentId,
      requestId: input.requestId ?? null,
    });
    return updated;
  }
}

export class DeleteArticleCommentUseCase {
  constructor(private readonly repo: ArticleRepository) {}
  async execute(commentId: string, userId: string): Promise<void> {
    const ok = await this.repo.markCommentDeletedByAuthor(commentId, userId);
    if (!ok) {
      throw new NotFoundError('COMMENT_NOT_FOUND', 'Komentar tidak ditemukan');
    }
  }
}

export class TakedownArticleCommentUseCase {
  constructor(
    private readonly repo: ArticleRepository,
    private readonly auditRepo: AuditLogRepository,
  ) {}
  async execute(commentId: string, actorId: string): Promise<void> {
    const ok = await this.repo.takedownComment(commentId, actorId);
    if (!ok) {
      throw new NotFoundError('COMMENT_NOT_FOUND', 'Komentar tidak ditemukan');
    }
    await this.auditRepo.record({
      userId: actorId,
      action: 'takedown',
      entityType: 'article_comment',
      entityId: commentId,
    });
  }
}

export class ToggleArticleBookmarkUseCase {
  constructor(private readonly repo: ArticleRepository) {}
  async execute(userId: string, articleId: string): Promise<boolean> {
    const exists = await this.repo.articleTargetExists(articleId);
    if (!exists) {
      throw new NotFoundError('ARTICLE_NOT_FOUND', 'Artikel tidak ditemukan');
    }
    return this.repo.toggleBookmark(userId, articleId);
  }
}

// -------------------------------------------------------------- kontribusi

export interface SubmitContributionInput {
  userId: string;
  kind: 'new' | 'edit';
  articleId: string | null;
  payload: {
    title: string;
    excerpt: string;
    body_md: string;
    category_id: string;
    tags: string[];
    cover_url?: string | null;
    source_url?: string | null;
    references_md?: string | null;
  };
  requestId?: string | null;
}

export class SubmitArticleContributionUseCase {
  constructor(
    private readonly repo: ArticleRepository,
    private readonly auditRepo: AuditLogRepository,
    // blocklist tidak dipakai di submit (artikel dimoderasi manual);
    // di-keep untuk simetri DI dengan use case komentar.
    private readonly blocklistRepo: CommentBlocklistRepository,
    private readonly abuse?: RecordAbuseSignalUseCase,
  ) {
    void this.blocklistRepo;
  }

  async execute(input: SubmitContributionInput): Promise<ArticleContribution> {
    await assertCanContribute(input.userId);
    validateArticlePayload(input.payload);

    // Quality gate isi (sama seperti komentar/pantun, tapi non-blocking
    // untuk artikel panjang: strike dicatat, teks tetap dinilai admin).
    await assertUgcTextQualityWithStrike(
      input.payload.title,
      {
        userId: input.userId,
        abuse: this.abuse,
        entityType: 'article_contribution',
        requestId: input.requestId,
        field: 'title',
      },
    );

    const categories = await this.repo.listCategories();
    if (
      !categories.some(
        (c) => c.id === input.payload.category_id && c.status === 'published',
      )
    ) {
      throw new BadRequestError(
        'CATEGORY_NOT_FOUND',
        'Kategori artikel tidak ditemukan',
        [{ field: 'category_id', message: 'Pilih kategori yang valid' }],
      );
    }

    let article = null;
    let baseUpdatedAt: Date | null = null;
    let resolvedArticleId: string | null = null;
    if (input.kind === 'edit') {
      if (!input.articleId) {
        throw new BadRequestError(
          'VALIDATION_ERROR',
          'Usulan edit wajib menyebut artikel',
          [{ field: 'article_id', message: 'Artikel wajib dipilih' }],
        );
      }
      // Klien sering kirim slug dari URL; normalisasi ke ULID sebelum simpan.
      article =
        (await this.repo.findById(input.articleId)) ??
        (await this.repo.findBySlug(input.articleId));
      if (!article || article.status !== 'published') {
        throw new NotFoundError(
          'ARTICLE_NOT_FOUND',
          'Artikel tidak ditemukan atau sudah tidak tayang',
        );
      }
      resolvedArticleId = article.id;
      baseUpdatedAt = article.updatedAt ?? article.createdAt;
      if (await this.repo.hasActiveEditByOthers(resolvedArticleId, input.userId)) {
        throw new ConflictError(
          'CONTRIBUTION_CONFLICT',
          'Sudah ada usulan perubahan lain untuk artikel ini. Tunggu sampai diproses ya.',
        );
      }
    }

    const created = await this.repo.createContribution({
      userId: input.userId,
      kind: input.kind,
      articleId: resolvedArticleId,
      payload: input.payload,
      baseUpdatedAt,
    });
    await this.auditRepo.record({
      userId: input.userId,
      action: 'submit',
      entityType: 'article_contribution',
      entityId: created.id,
      newData: { kind: input.kind, article_id: resolvedArticleId },
      requestId: input.requestId ?? null,
    });
    return created;
  }
}

export class ResubmitArticleContributionUseCase {
  constructor(
    private readonly repo: ArticleRepository,
    private readonly auditRepo: AuditLogRepository,
    private readonly blocklistRepo: CommentBlocklistRepository,
    private readonly abuse?: RecordAbuseSignalUseCase,
  ) {}

  /** Kirim ulang usulan yang statusnya needs_revision: payload diganti. */  async execute(input: {
    contributionId: string;
    userId: string;
    payload: SubmitContributionInput['payload'];
    requestId?: string | null;
  }): Promise<ArticleContribution> {
    await assertCanContribute(input.userId);
    const existing = await this.repo.findContributionById(input.contributionId);
    if (!existing || existing.userId !== input.userId) {
      throw new NotFoundError('CONTRIBUTION_NOT_FOUND', 'Usulan tidak ditemukan');
    }
    if (existing.status !== 'needs_revision') {
      throw new ConflictError(
        'CONTRIBUTION_NOT_RESUBMITTABLE',
        'Hanya usulan dengan catatan revisi yang bisa dikirim ulang',
      );
    }
    validateArticlePayload(input.payload);
    // Reuse submit path: payload baru jadi usulan pending (riwayat lama
    // tetap tercatat di baris lama; statusnya sudah bukan aktif).
    void this.blocklistRepo;
    return this.submitNew(input, existing);
  }

  private async submitNew(
    input: {
      contributionId: string;
      userId: string;
      payload: SubmitContributionInput['payload'];
      requestId?: string | null;
    },
    previous: ArticleContribution,
  ): Promise<ArticleContribution> {
    // Tandai baris lama selesai (rejected tanpa alasan = resubmit path).
    await this.repo.setContributionStatus({
      id: previous.id,
      status: 'rejected',
      rejectReasonCode: 'resubmitted',
      rejectReasonText: 'Dikirim ulang sebagai usulan baru',
    });
    const submitter = new SubmitArticleContributionUseCase(
      this.repo,
      this.auditRepo,
      this.blocklistRepo,
      this.abuse,
    );
    return submitter.execute({
      userId: input.userId,
      kind: previous.kind,
      articleId: previous.articleId,
      payload: input.payload,
      requestId: input.requestId,
    });
  }
}

export class ListMyArticleContributionsUseCase {
  constructor(private readonly repo: ArticleRepository) {}
  async execute(
    userId: string,
    cursor: string | undefined,
    limit: number,
  ): Promise<CursorPage<ArticleContribution>> {
    return this.repo.listContributions({ userId, cursor, limit });
  }
}

export class ReviewArticleContributionUseCase {
  constructor(
    private readonly repo: ArticleRepository,
    private readonly auditRepo: AuditLogRepository,
    private readonly activityEvents?: RecordActivityEventUseCase,
  ) {}

  async execute(input: {
    contributionId: string;
    decision: 'approve' | 'needs_revision' | 'reject';
    reviewerId: string;
    revisionNote?: string | null;
    rejectReasonCode?: string | null;
    rejectReasonText?: string | null;
    requestId?: string | null;
  }): Promise<ArticleContribution> {
    const contribution = await this.repo.findContributionById(input.contributionId);
    if (!contribution) {
      throw new NotFoundError('CONTRIBUTION_NOT_FOUND', 'Usulan tidak ditemukan');
    }
    if (contribution.status !== 'pending' && contribution.status !== 'needs_revision') {
      throw new ConflictError(
        'CONTRIBUTION_ALREADY_REVIEWED',
        'Usulan ini sudah diproses',
      );
    }

    if (input.decision === 'approve') {
      return this.approve(contribution, input);
    }

    const status =
      input.decision === 'needs_revision' ? 'needs_revision' : 'rejected';
    const reviewed = await this.repo.setContributionStatus({
      id: contribution.id,
      status,
      ...(input.decision === 'needs_revision'
        ? { revisionNote: input.revisionNote ?? null }
        : {
            rejectReasonCode: input.rejectReasonCode ?? 'other',
            rejectReasonText: input.rejectReasonText ?? null,
          }),
    });
    await this.auditRepo.record({
      userId: input.reviewerId,
      action: `review:${input.decision}`,
      entityType: 'article_contribution',
      entityId: contribution.id,
      newData: { status },
      requestId: input.requestId ?? null,
    });
    if (!reviewed) {
      throw new NotFoundError('CONTRIBUTION_NOT_FOUND', 'Usulan tidak ditemukan');
    }
    return reviewed;
  }

  private async approve(
    contribution: ArticleContribution,
    input: NonNullable<Parameters<ReviewArticleContributionUseCase['execute']>[0]>,
  ): Promise<ArticleContribution> {
    if (contribution.kind === 'edit') {
      return this.approveEdit(contribution, input);
    }
    // kind=new: buat artikel published langsung.
    const { CreateArticleUseCase } = await import('./article.use-cases');
    const creator = new CreateArticleUseCase(
      this.repo,
      this.auditRepo,
      this.activityEvents,
    );
    const article = await creator.execute({
      title: contribution.payload.title,
      excerpt: contribution.payload.excerpt,
      bodyMd: contribution.payload.body_md,
      categoryId: contribution.payload.category_id,
      tags: contribution.payload.tags,
      coverUrl: contribution.payload.cover_url ?? null,
      sourceUrl: contribution.payload.source_url ?? null,
      referencesMd: contribution.payload.references_md ?? null,
      authorUserId: contribution.userId,
      status: 'published',
      requestId: input.requestId,
    });
    const reviewed = await this.repo.setContributionStatus({
      id: contribution.id,
      status: 'approved',
      resultArticleId: article.id,
    });
    await this.auditRepo.record({
      userId: input.reviewerId,
      action: 'review:approve',
      entityType: 'article_contribution',
      entityId: contribution.id,
      newData: { status: 'approved', result_article_id: article.id },
      requestId: input.requestId ?? null,
    });
    if (!reviewed) {
      throw new NotFoundError('CONTRIBUTION_NOT_FOUND', 'Usulan tidak ditemukan');
    }
    return reviewed;
  }

  private async approveEdit(
    contribution: ArticleContribution,
    input: {
      reviewerId: string;
      requestId?: string | null;
    },
  ): Promise<ArticleContribution> {
    if (!contribution.articleId) {
      throw new BadRequestError(
        'CONTRIBUTION_NO_TARGET',
        'Usulan edit tanpa artikel target',
      );
    }
    const article = await this.repo.findById(contribution.articleId);
    if (!article) {
      throw new NotFoundError('ARTICLE_NOT_FOUND', 'Artikel tidak ditemukan');
    }
    // Stale check: artikel berubah sejak usulan dibuat.
    const baseMs = contribution.baseUpdatedAt?.getTime();
    const currentMs = (article.updatedAt ?? article.createdAt).getTime();
    if (baseMs !== null && baseMs !== undefined && baseMs !== currentMs) {
      throw new ConflictError(
        'CONTRIBUTION_STALE',
        'Artikel sudah berubah sejak usulan dibuat. Tinjau ulang lalu setujui lagi.',
      );
    }
    const { UpdateArticleUseCase } = await import('./article.use-cases');
    const updater = new UpdateArticleUseCase(this.repo, this.auditRepo);
    await updater.execute(article.id, {
      title: contribution.payload.title,
      excerpt: contribution.payload.excerpt,
      bodyMd: contribution.payload.body_md,
      categoryId: contribution.payload.category_id,
      tags: contribution.payload.tags,
      coverUrl: contribution.payload.cover_url ?? null,
      sourceUrl: contribution.payload.source_url ?? null,
      referencesMd: contribution.payload.references_md ?? null,
      editorId: input.reviewerId,
      contributionId: contribution.id,
      changeNote: 'Terima usulan perubahan',
      requestId: input.requestId,
    });
    const reviewed = await this.repo.setContributionStatus({
      id: contribution.id,
      status: 'approved',
      resultArticleId: article.id,
    });
    await this.auditRepo.record({
      userId: input.reviewerId,
      action: 'review:approve',
      entityType: 'article_contribution',
      entityId: contribution.id,
      newData: { status: 'approved', result_article_id: article.id },
      requestId: input.requestId ?? null,
    });
    if (!reviewed) {
      throw new NotFoundError('CONTRIBUTION_NOT_FOUND', 'Usulan tidak ditemukan');
    }
    return reviewed;
  }
}

export class ListArticleContributionsUseCase {
  constructor(private readonly repo: ArticleRepository) {}
  async execute(
    status: 'pending' | 'needs_revision' | 'approved' | 'rejected' | undefined,
    cursor: string | undefined,
    limit: number,
  ): Promise<CursorPage<ArticleContribution>> {
    return this.repo.listContributions({ status, cursor, limit });
  }
}

export type { NewArticleContributionInput };
