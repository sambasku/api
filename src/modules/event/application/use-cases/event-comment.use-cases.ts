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
import type { EventComment } from '../../domain/entities/event.entity';
import type { EventRepository } from '../../domain/repositories/event.repository';
import type { CursorPage } from '@/modules/word/domain/repositories/word.repository';

// ---------------------------------------------------------------- komentar

export class ListEventCommentsUseCase {
  constructor(private readonly repo: EventRepository) {}
  async execute(
    eventId: string,
    cursor: string | undefined,
    limit: number,
  ): Promise<CursorPage<EventComment>> {
    return this.repo.listComments(eventId, {
      status: 'published',
      cursor,
      limit,
    });
  }
}

export class CreateEventCommentUseCase {
  constructor(
    private readonly repo: EventRepository,
    private readonly auditRepo: AuditLogRepository,
    private readonly blocklistRepo: CommentBlocklistRepository,
    private readonly abuse?: RecordAbuseSignalUseCase,
    private readonly activityEvents?: RecordActivityEventUseCase,
  ) {}

  async execute(input: {
    eventId: string;
    userId: string;
    body: string;
    requestId?: string | null;
  }): Promise<EventComment> {
    await assertCanContribute(input.userId);
    const exists = await this.repo.eventTargetExists(input.eventId);
    if (!exists) {
      throw new NotFoundError(
        'EVENT_NOT_FOUND',
        'Acara tidak ditemukan atau sudah tidak tayang',
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
      entityType: 'event_comment',
      requestId: input.requestId,
    });
    const blocked = await this.blocklistRepo.listAllActiveWords();
    const filtered = applyBlocklistFilter(body, blocked);
    const created = await this.repo.createComment({
      eventId: input.eventId,
      userId: input.userId,
      body: filtered,
      bodyOriginal: filtered !== body ? body : null,
    });
    await this.auditRepo.record({
      userId: input.userId,
      action: 'create',
      entityType: 'event_comment',
      entityId: created.id,
      newData: { event_id: input.eventId },
      requestId: input.requestId ?? null,
    });
    await this.activityEvents?.safe({
      kind: 'event_comment_created',
      actorId: input.userId,
      targetId: created.id,
      dedupeKey: `event_comment:${created.id}`,
    });
    return created;
  }
}

export class UpdateEventCommentUseCase {
  constructor(
    private readonly repo: EventRepository,
    private readonly auditRepo: AuditLogRepository,
    private readonly blocklistRepo: CommentBlocklistRepository,
    private readonly abuse?: RecordAbuseSignalUseCase,
  ) {}

  async execute(input: {
    commentId: string;
    userId: string;
    body: string;
    requestId?: string | null;
  }): Promise<EventComment> {
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
      entityType: 'event_comment',
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
      entityType: 'event_comment',
      entityId: input.commentId,
      requestId: input.requestId ?? null,
    });
    return updated;
  }
}

export class DeleteEventCommentUseCase {
  constructor(private readonly repo: EventRepository) {}
  async execute(commentId: string, userId: string): Promise<void> {
    const ok = await this.repo.markCommentDeletedByAuthor(commentId, userId);
    if (!ok) {
      throw new NotFoundError('COMMENT_NOT_FOUND', 'Komentar tidak ditemukan');
    }
  }
}

export class TakedownEventCommentUseCase {
  constructor(
    private readonly repo: EventRepository,
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
      entityType: 'event_comment',
      entityId: commentId,
    });
  }
}
