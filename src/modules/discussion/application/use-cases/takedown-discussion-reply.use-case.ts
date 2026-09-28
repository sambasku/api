import { ConflictError, NotFoundError } from '@/shared/errors/app-error';
import type { AuditLogRepository } from '@/modules/audit/domain/repositories/audit-log.repository';
import type { DiscussionReply } from '../../domain/entities/discussion.entity';
import type { DiscussionRepository } from '../../domain/repositories/discussion.repository';

export interface TakedownDiscussionReplyCommand {
  replyId: string;
  reviewerId: string;
  requestId?: string | null;
}

export class TakedownDiscussionReplyUseCase {
  constructor(
    private readonly repo: DiscussionRepository,
    private readonly auditRepo: AuditLogRepository,
  ) {}

  async execute(cmd: TakedownDiscussionReplyCommand): Promise<DiscussionReply> {
    const reply = await this.repo.findReplyById(cmd.replyId);
    if (!reply) {
      throw new NotFoundError(
        'DISCUSSION_REPLY_NOT_FOUND',
        'Balasan tidak ditemukan',
      );
    }

    const ok = await this.repo.takedownReply(cmd.replyId, cmd.reviewerId);
    if (!ok) {
      throw new ConflictError(
        'DISCUSSION_REPLY_NOT_FOUND',
        'Balasan sudah di-takedown atau tidak lagi diterbitkan',
      );
    }

    const help = await this.repo.findById(reply.discussionId);
    if (help?.pinnedReplyId === reply.id) {
      await this.repo.setPinnedReply({
        discussionId: reply.discussionId,
        replyId: null,
        actorId: cmd.reviewerId,
      });
    }

    await this.auditRepo.record({
      userId: cmd.reviewerId,
      action: 'takedown',
      entityType: 'discussion_reply',
      entityId: reply.id,
      oldData: { status: reply.status, discussion_id: reply.discussionId },
      newData: { status: 'taken_down' },
      requestId: cmd.requestId ?? null,
    });

    return (await this.repo.findReplyById(cmd.replyId)) ?? reply;
  }
}
