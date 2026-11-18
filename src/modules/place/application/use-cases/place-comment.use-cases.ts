import {
  BadRequestError,
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
import type { CursorPage } from '@/modules/word/domain/repositories/word.repository';
import type { PlaceComment } from '../../domain/entities/place.entity';
import type { PlaceRepository } from '../../domain/repositories/place.repository';

export class ListPlaceCommentsUseCase {
  constructor(private readonly repo: PlaceRepository) {}
  async execute(
    placeId: string,
    cursor: string | undefined,
    limit: number,
  ): Promise<CursorPage<PlaceComment>> {
    return this.repo.listComments(placeId, {
      status: 'published',
      cursor,
      limit,
    });
  }
}

export class CreatePlaceCommentUseCase {
  constructor(
    private readonly repo: PlaceRepository,
    private readonly auditRepo: AuditLogRepository,
    private readonly blocklistRepo: CommentBlocklistRepository,
    private readonly abuse?: RecordAbuseSignalUseCase,
    private readonly activityEvents?: RecordActivityEventUseCase,
  ) {}

  async execute(input: {
    placeId: string;
    userId: string;
    body: string;
    requestId?: string | null;
  }): Promise<PlaceComment> {
    await assertCanContribute(input.userId);
    const exists = await this.repo.placeTargetExists(input.placeId);
    if (!exists) {
      throw new NotFoundError(
        'PLACE_NOT_FOUND',
        'Wisata tidak ditemukan atau sudah tidak tayang',
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
      entityType: 'place_comment',
      requestId: input.requestId,
    });
    const blocked = await this.blocklistRepo.listAllActiveWords();
    const filtered = applyBlocklistFilter(body, blocked);
    const created = await this.repo.createComment({
      placeId: input.placeId,
      userId: input.userId,
      body: filtered,
      bodyOriginal: filtered !== body ? body : null,
    });
    await this.auditRepo.record({
      userId: input.userId,
      action: 'create',
      entityType: 'place_comment',
      entityId: created.id,
      newData: { place_id: input.placeId },
      requestId: input.requestId ?? null,
    });
    await this.activityEvents?.safe({
      kind: 'place_comment_created',
      actorId: input.userId,
      targetId: created.id,
      dedupeKey: `place_comment:${created.id}`,
    });
    return created;
  }
}

export class UpdatePlaceCommentUseCase {
  constructor(
    private readonly repo: PlaceRepository,
    private readonly auditRepo: AuditLogRepository,
    private readonly blocklistRepo: CommentBlocklistRepository,
    private readonly abuse?: RecordAbuseSignalUseCase,
  ) {}

  async execute(input: {
    commentId: string;
    userId: string;
    body: string;
    requestId?: string | null;
  }): Promise<PlaceComment> {
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
      entityType: 'place_comment',
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
      entityType: 'place_comment',
      entityId: input.commentId,
      requestId: input.requestId ?? null,
    });
    return updated;
  }
}

export class DeletePlaceCommentUseCase {
  constructor(private readonly repo: PlaceRepository) {}
  async execute(commentId: string, userId: string): Promise<void> {
    const ok = await this.repo.markCommentDeletedByAuthor(commentId, userId);
    if (!ok) {
      throw new NotFoundError('COMMENT_NOT_FOUND', 'Komentar tidak ditemukan');
    }
  }
}

export class TakedownPlaceCommentUseCase {
  constructor(
    private readonly repo: PlaceRepository,
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
      entityType: 'place_comment',
      entityId: commentId,
    });
  }
}