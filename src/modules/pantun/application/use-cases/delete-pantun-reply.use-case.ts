import { ForbiddenError, NotFoundError } from '@/shared/errors/app-error';
import type { AuditLogRepository } from '@/modules/audit/domain/repositories/audit-log.repository';
import type { PronunciationStoragePort } from '@/modules/word/application/ports/pronunciation-storage.port';
import type { PantunRepository } from '../../domain/repositories/pantun.repository';

/** Hapus balasan sendiri (soft: status deleted_by_author). */
export class DeletePantunReplyUseCase {
  constructor(
    private readonly repo: PantunRepository,
    private readonly auditRepo: AuditLogRepository,
    private readonly audioStorage?: PronunciationStoragePort,
  ) {}

  async execute(cmd: {
    replyId: string;
    actorId: string;
    requestId?: string | null;
  }): Promise<void> {
    const reply = await this.repo.findReplyById(cmd.replyId);
    if (!reply || reply.status !== 'published') {
      throw new NotFoundError(
        'PANTUN_REPLY_NOT_FOUND',
        'Balasan tidak ditemukan',
      );
    }

    if (reply.userId !== cmd.actorId) {
      throw new ForbiddenError(
        'FORBIDDEN',
        'Hanya penulis yang dapat menghapus balasan ini. Verifikator memakai takedown.',
      );
    }

    const ok = await this.repo.markReplyDeletedByAuthor(cmd.replyId, cmd.actorId);
    if (!ok) {
      throw new NotFoundError(
        'PANTUN_REPLY_NOT_FOUND',
        'Balasan tidak ditemukan',
      );
    }

    if (reply.audio?.providerFileId && reply.audio.sha && this.audioStorage) {
      try {
        await this.audioStorage.delete(
          reply.audio.providerFileId,
          reply.audio.sha,
        );
      } catch {
        // best-effort
      }
    }

    await this.auditRepo.record({
      userId: cmd.actorId,
      action: 'delete',
      entityType: 'pantun_reply',
      entityId: cmd.replyId,
      oldData: { status: 'published' },
      newData: { status: 'deleted_by_author' },
      requestId: cmd.requestId ?? null,
    });
  }
}
