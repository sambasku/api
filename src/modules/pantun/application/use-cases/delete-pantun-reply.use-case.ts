import { ForbiddenError, NotFoundError } from '@/shared/errors/app-error';
import type { AuditLogRepository } from '@/modules/audit/domain/repositories/audit-log.repository';
import type { PantunRepository } from '../../domain/repositories/pantun.repository';

/** Hapus balasan sendiri (soft: status deleted_by_author). */
export class DeletePantunReplyUseCase {
  constructor(
    private readonly repo: PantunRepository,
    private readonly auditRepo: AuditLogRepository,
  ) {}
  async execute(cmd: { replyId: string; actorId: string; requestId?: string | null }): Promise<void> {
    const reply = await this.repo.findReplyById(cmd.replyId);
    if (!reply || reply.status !== 'published') {
      throw new NotFoundError('PANTUN_REPLY_NOT_FOUND', 'Balasan tidak ditemukan');
    }

    // 403 (bukan 404): user lain tidak boleh merasa balasan "tidak ada".
    if (reply.userId !== cmd.actorId) {
      throw new ForbiddenError(
        'FORBIDDEN',
        'Hanya penulis yang dapat menghapus balasan ini. Verifikator memakai takedown.',
      );
    }

    const ok = await this.repo.markReplyDeletedByAuthor(cmd.replyId, cmd.actorId);
    if (!ok) {
      throw new NotFoundError('PANTUN_REPLY_NOT_FOUND', 'Balasan tidak ditemukan');
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
