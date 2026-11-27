import { buildCommentEditHistoryWire, resolveCommentParentId } from '@/shared/comment/comment-threading';
import {
  BadRequestError,
  ForbiddenError,
  NotFoundError,
} from '@/shared/errors/app-error';
import type { AuditLogRepository } from '@/modules/audit/domain/repositories/audit-log.repository';
import type { CommentBlocklistRepository } from '@/modules/comment-blocklist/domain/repositories/comment-blocklist.repository';
import { applyBlocklistFilter } from '@/modules/comment-blocklist/application/utils/apply-blocklist-filter';
import type { StickerRepository } from '@/modules/sticker/domain/repositories/sticker.repository';
import { assertCanContribute } from '@/modules/word/application/utils/assert-can-contribute';
import { assertUgcTextQualityWithStrike } from '@/shared/moderation/assert-ugc-text-quality-with-strike';
import type { RecordAbuseSignalUseCase } from '@/shared/moderation/record-abuse-signal.use-case';
import type { RecordActivityEventUseCase } from '@/modules/activity/application/use-cases/record-activity-event.use-case';
import { commentFeedPayload } from '@/modules/activity/application/utils/activity-body-snippet';
import { prepareEntityCommentCreate } from '@/shared/comment/prepare-entity-comment-create';
import type {
  KaryaComment,
  KaryaCommentRepository,
} from '../../domain/karya-comment';
import type { CursorPage } from '@/modules/word/domain/repositories/word.repository';

// ---------------------------------------------------------------- komentar

export class ListKaryaCommentsUseCase {
  constructor(private readonly repo: KaryaCommentRepository) {}
  async execute(
    karyaId: string,
    cursor: string | undefined,
    limit: number,
  ): Promise<CursorPage<KaryaComment>> {
    return this.repo.listComments(karyaId, {
      status: 'published',
      cursor,
      limit,
    });
  }

  async getEditHistory(commentId: string) {
    const comment = await this.repo.findCommentById(commentId);
    if (!comment) {
      throw new NotFoundError('COMMENT_NOT_FOUND', 'Komentar tidak ditemukan');
    }
    const revisions =
      typeof this.repo.listCommentRevisions === 'function'
        ? await this.repo.listCommentRevisions(commentId)
        : [];
    return buildCommentEditHistoryWire(comment, revisions);
  }
}

export class CreateKaryaCommentUseCase {
  constructor(
    private readonly repo: KaryaCommentRepository,
    private readonly auditRepo: AuditLogRepository,
    private readonly blocklistRepo: CommentBlocklistRepository,
    private readonly abuse?: RecordAbuseSignalUseCase,
    private readonly activityEvents?: RecordActivityEventUseCase,
    private readonly stickerRepo?: StickerRepository,
  ) {}

  async execute(input: {
    karyaId: string;
    parentId?: string | null;
    userId: string;
    body?: string;
    stickerId?: string | null;
    image?: { url: string; providerFileId: string } | null;
    requestId?: string | null;
  }): Promise<KaryaComment> {
    await assertCanContribute(input.userId);
    const exists = await this.repo.karyaTargetExists(input.karyaId);
    if (!exists) {
      throw new NotFoundError(
        'KARYA_NOT_FOUND',
        'Karya tidak ditemukan atau sudah tidak tayang',
      );
    }
    const prepared = await prepareEntityCommentCreate({
      userId: input.userId,
      requestId: input.requestId,
      entityType: 'karya_comment',
      body: input.body,
      stickerId: input.stickerId,
      image: input.image,
      stickerRepo: this.stickerRepo,
      blocklistRepo: this.blocklistRepo,
      abuse: this.abuse,
    });
    const parentId = await resolveCommentParentId({
      rawParentId: input.parentId,
      hostId: input.karyaId,
      findParent: async (id) => {
        const p = await this.repo.findCommentById(id);
        return p ? { id: p.id, hostId: p.karyaId, parentId: p.parentId ?? null, status: p.status } : null;
      },
    });
    const created = await this.repo.createComment({
      karyaId: input.karyaId,
      parentId,
      userId: input.userId,
      body: prepared.body,
      bodyOriginal: prepared.bodyOriginal,
      stickerId: prepared.stickerId,
      image: prepared.image,
    });
    await this.auditRepo.record({
      userId: input.userId,
      action: 'create',
      entityType: 'karya_comment',
      entityId: created.id,
      newData: {
        karya_id: input.karyaId,
        sticker_id: prepared.stickerId,
        image_status: created.image?.status ?? null,
      },
      requestId: input.requestId ?? null,
    });
    await this.activityEvents?.safe({
      kind: 'karya_comment_created',
      actorId: input.userId,
      targetId: created.id,
      dedupeKey: `karya_comment:${created.id}`,
      payload: commentFeedPayload({
        body: created.body,
        stickerId: prepared.stickerId,
        hasImage: Boolean(prepared.image),
      }),
    });
    return created;
  }
}

export class UpdateKaryaCommentUseCase {
  constructor(
    private readonly repo: KaryaCommentRepository,
    private readonly auditRepo: AuditLogRepository,
    private readonly blocklistRepo: CommentBlocklistRepository,
    private readonly abuse?: RecordAbuseSignalUseCase,
  ) {}

  async execute(input: {
    commentId: string;
    userId: string;
    body: string;
    requestId?: string | null;
  }): Promise<KaryaComment> {
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
      entityType: 'karya_comment',
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
      entityType: 'karya_comment',
      entityId: input.commentId,
      requestId: input.requestId ?? null,
    });
    return updated;
  }
}

export class DeleteKaryaCommentUseCase {
  constructor(private readonly repo: KaryaCommentRepository) {}
  async execute(commentId: string, userId: string): Promise<void> {
    const ok = await this.repo.markCommentDeletedByAuthor(commentId, userId);
    if (!ok) {
      throw new NotFoundError('COMMENT_NOT_FOUND', 'Komentar tidak ditemukan');
    }
  }
}

export class TakedownKaryaCommentUseCase {
  constructor(
    private readonly repo: KaryaCommentRepository,
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
      entityType: 'karya_comment',
      entityId: commentId,
    });
  }
}