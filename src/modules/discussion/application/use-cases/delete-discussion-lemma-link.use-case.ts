import type { AuditLogRepository } from '@/modules/audit/domain/repositories/audit-log.repository';
import { ForbiddenError, NotFoundError } from '@/shared/errors/app-error';
import type { DiscussionRepository } from '../../domain/repositories/discussion.repository';

export class DeleteDiscussionLemmaLinkUseCase {
  constructor(
    private readonly repo: DiscussionRepository,
    private readonly auditRepo: AuditLogRepository,
  ) {}

  async execute(input: {
    discussionId: string;
    linkId: string;
    userId: string;
    isStaff?: boolean;
    requestId?: string | null;
  }): Promise<void> {
    const help = await this.repo.findById(input.discussionId);
    if (!help) {
      throw new NotFoundError('DISCUSSION_NOT_FOUND', 'Diskusi tidak ditemukan');
    }

    const link = await this.repo.findLemmaLinkById(input.linkId);
    if (!link || link.discussionId !== input.discussionId) {
      throw new NotFoundError(
        'DISCUSSION_LEMMA_LINK_NOT_FOUND',
        'Tautan lemma tidak ditemukan',
      );
    }

    const isDiscussionOwner = help.userId === input.userId;
    let isReplyAuthor = false;
    if (link.replyId) {
      const reply = await this.repo.findReplyById(link.replyId);
      isReplyAuthor = !!reply && reply.userId === input.userId;
    }

    if (!isDiscussionOwner && !isReplyAuthor && !input.isStaff) {
      throw new ForbiddenError(
        'NOT_OWNER',
        'Hanya penulis atau tim yang bisa menghapus tautan lemma',
      );
    }

    await this.repo.deleteLemmaLink(input.linkId);

    await this.auditRepo.record({
      userId: input.userId,
      action: 'delete',
      entityType: 'discussion_lemma_link',
      entityId: input.linkId,
      oldData: {
        discussion_id: input.discussionId,
        reply_id: link.replyId,
        word_id: link.wordId,
        start: link.start,
        end: link.end,
      },
      requestId: input.requestId ?? null,
    });
  }
}
