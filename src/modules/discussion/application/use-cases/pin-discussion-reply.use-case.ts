import { NotFoundError, ValidationError } from '@/shared/errors/app-error';
import type { AuditLogRepository } from '@/modules/audit/domain/repositories/audit-log.repository';
import type { Discussion } from '../../domain/entities/discussion.entity';
import type { DiscussionRepository } from '../../domain/repositories/discussion.repository';

export interface PinDiscussionReplyCommand {
  discussionId: string;
  replyId: string;
  actorId: string;
  requestId?: string | null;
}

export class PinDiscussionReplyUseCase {
  constructor(
    private readonly repo: DiscussionRepository,
    private readonly auditRepo: AuditLogRepository,
  ) {}

  async execute(cmd: PinDiscussionReplyCommand): Promise<Discussion> {
    const help = await this.repo.findById(cmd.discussionId);
    if (!help) {
      throw new NotFoundError('DISCUSSION_NOT_FOUND', 'Diskusi tidak ditemukan');
    }

    const reply = await this.repo.findReplyById(cmd.replyId);
    if (!reply || reply.discussionId !== cmd.discussionId) {
      throw new NotFoundError(
        'DISCUSSION_REPLY_NOT_FOUND',
        'Balasan tidak ditemukan',
      );
    }
    if (reply.status !== 'published') {
      throw new ValidationError([
        { field: 'reply_id', message: 'Hanya balasan yang tayang yang bisa di-pin' },
      ]);
    }

    const updated = await this.repo.setPinnedReply({
      discussionId: cmd.discussionId,
      replyId: cmd.replyId,
      actorId: cmd.actorId,
    });
    if (!updated) {
      throw new NotFoundError('DISCUSSION_NOT_FOUND', 'Diskusi tidak ditemukan');
    }

    await this.auditRepo.record({
      userId: cmd.actorId,
      action: 'update',
      entityType: 'discussion',
      entityId: updated.id,
      oldData: { pinned_reply_id: help.pinnedReplyId },
      newData: { pinned_reply_id: cmd.replyId },
      requestId: cmd.requestId ?? null,
    });

    return updated;
  }
}
