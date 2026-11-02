import { ForbiddenError, NotFoundError } from '@/shared/errors/app-error';
import type { AuditLogRepository } from '@/modules/audit/domain/repositories/audit-log.repository';
import type { PronunciationStoragePort } from '@/modules/word/application/ports/pronunciation-storage.port';
import type { DiscussionRepository } from '../../domain/repositories/discussion.repository';

export interface DeleteDiscussionCommand {
  discussionId: string;
  actorId: string;
  requestId?: string | null;
}

/**
 * Batalkan penayangan OP (#202): published → deleted_by_author.
 * Verifikator memakai takedown, bukan endpoint ini. Tanpa inbox taken_down.
 */
export class DeleteDiscussionUseCase {
  constructor(
    private readonly repo: DiscussionRepository,
    private readonly auditRepo: AuditLogRepository,
    private readonly storage?: PronunciationStoragePort,
  ) {}

  async execute(cmd: DeleteDiscussionCommand): Promise<void> {
    const help = await this.repo.findById(cmd.discussionId);
    if (!help || help.status !== 'published') {
      throw new NotFoundError('DISCUSSION_NOT_FOUND', 'Diskusi tidak ditemukan');
    }

    if (help.userId !== cmd.actorId) {
      throw new ForbiddenError(
        'FORBIDDEN',
        'Hanya penulis yang dapat membatalkan penayangan diskusi ini. Verifikator memakai takedown.',
      );
    }

    const ok = await this.repo.markDiscussionDeletedByAuthor(
      cmd.discussionId,
      cmd.actorId,
    );
    if (!ok) {
      throw new NotFoundError('DISCUSSION_NOT_FOUND', 'Diskusi tidak ditemukan');
    }

    if (help.audio?.providerFileId && help.audio.sha && this.storage) {
      try {
        await this.storage.delete(help.audio.providerFileId, help.audio.sha);
      } catch {
        // best-effort
      }
    }

    await this.auditRepo.record({
      userId: cmd.actorId,
      action: 'delete',
      entityType: 'discussion',
      entityId: cmd.discussionId,
      oldData: { status: 'published', has_audio: help.audio != null },
      newData: { status: 'deleted_by_author' },
      requestId: cmd.requestId ?? null,
    });
  }
}
