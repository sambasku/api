import { ForbiddenError, NotFoundError } from '@/shared/errors/app-error';
import type { AuditLogRepository } from '@/modules/audit/domain/repositories/audit-log.repository';
import type { PronunciationStoragePort } from '@/modules/word/application/ports/pronunciation-storage.port';
import type { DiscussionRepository } from '../../domain/repositories/discussion.repository';

export interface DeleteDiscussionReplyCommand {
  replyId: string;
  actorId: string;
  requestId?: string | null;
}

export class DeleteDiscussionReplyUseCase {
  constructor(
    private readonly repo: DiscussionRepository,
    private readonly auditRepo: AuditLogRepository,
    private readonly storage?: PronunciationStoragePort,
  ) {}

  async execute(cmd: DeleteDiscussionReplyCommand): Promise<void> {
    const reply = await this.repo.findReplyById(cmd.replyId);
    if (!reply) {
      throw new NotFoundError(
        'DISCUSSION_REPLY_NOT_FOUND',
        'Balasan tidak ditemukan',
      );
    }

    if (reply.userId !== cmd.actorId) {
      throw new ForbiddenError(
        'FORBIDDEN',
        'Hanya penulis yang dapat menghapus balasan ini. Verifikator memakai takedown.',
      );
    }

    if (reply.status !== 'published') {
      throw new NotFoundError(
        'DISCUSSION_REPLY_NOT_FOUND',
        'Balasan tidak ditemukan',
      );
    }

    const ok = await this.repo.markReplyDeletedByAuthor(cmd.replyId, cmd.actorId);
    if (!ok) {
      throw new NotFoundError(
        'DISCUSSION_REPLY_NOT_FOUND',
        'Balasan tidak ditemukan',
      );
    }

    const help = await this.repo.findById(reply.discussionId);
    if (help?.pinnedReplyId === reply.id) {
      await this.repo.setPinnedReply({
        discussionId: reply.discussionId,
        replyId: null,
        actorId: cmd.actorId,
      });
    }

    if (reply.audio?.sha && this.storage) {
      await this.storage.delete(reply.audio.providerFileId, reply.audio.sha);
    }

    await this.auditRepo.record({
      userId: cmd.actorId,
      action: 'delete',
      entityType: 'discussion_reply',
      entityId: reply.id,
      oldData: {
        discussion_id: reply.discussionId,
        status: reply.status,
        has_audio: reply.audio != null,
      },
      newData: { status: 'deleted_by_author' },
      requestId: cmd.requestId ?? null,
    });
  }
}
