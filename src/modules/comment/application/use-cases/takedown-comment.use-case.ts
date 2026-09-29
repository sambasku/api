import { ConflictError, NotFoundError } from '@/shared/errors/app-error';
import type { AuditLogRepository } from '@/modules/audit/domain/repositories/audit-log.repository';
import {
  RecordAbuseSignalUseCase,
  safeRecordAbuseSignal,
} from '@/shared/moderation/record-abuse-signal.use-case';
import type { Comment } from '../../domain/entities/comment.entity';
import type { CommentRepository } from '../../domain/repositories/comment.repository';

export interface TakedownCommentCommand {
  commentId: string;
  reviewerId: string;
  requestId?: string | null;
}

/** Takedown post-moderation: published → taken_down. */
export class TakedownCommentUseCase {
  constructor(
    private readonly commentRepo: CommentRepository,
    private readonly auditRepo: AuditLogRepository,
    private readonly abuse?: RecordAbuseSignalUseCase,
  ) {}

  async execute(cmd: TakedownCommentCommand): Promise<Comment> {
    const comment = await this.commentRepo.findById(cmd.commentId);
    if (!comment) {
      throw new NotFoundError('COMMENT_NOT_FOUND', 'Komentar tidak ditemukan');
    }

    const ok = await this.commentRepo.takedown(cmd.commentId, cmd.reviewerId);
    if (!ok) {
      throw new ConflictError(
        'COMMENT_ALREADY_MODERATED',
        'Komentar sudah di-takedown atau tidak lagi diterbitkan',
      );
    }

    await this.auditRepo.record({
      userId: cmd.reviewerId,
      action: 'takedown',
      entityType: 'comment',
      entityId: comment.id,
      oldData: { status: comment.status },
      newData: { status: 'taken_down' },
      requestId: cmd.requestId ?? null,
    });

    await safeRecordAbuseSignal(this.abuse, {
      userId: comment.userId,
      signal: 'comment_takedown',
      entityType: 'comment',
      entityId: comment.id,
      requestId: cmd.requestId,
      systemActorId: cmd.reviewerId,
    });

    const updated = await this.commentRepo.findById(cmd.commentId);
    return updated ?? comment;
  }
}
