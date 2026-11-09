import { ForbiddenError, NotFoundError } from '@/shared/errors/app-error';
import type { AuditLogRepository } from '@/modules/audit/domain/repositories/audit-log.repository';
import type { JinyeRepository } from '../../domain/repositories/jinye.repository';

export class DeleteJinyeCommentUseCase {
  constructor(
    private readonly repo: JinyeRepository,
    private readonly auditRepo: AuditLogRepository,
  ) {}

  async execute(cmd: {
    id: string;
    userId: string;
    requestId?: string | null;
  }): Promise<void> {
    const existing = await this.repo.findCommentById(cmd.id);
    if (!existing || existing.status !== 'published') {
      throw new NotFoundError('JINYE_COMMENT_NOT_FOUND', 'Komentar tidak ditemukan');
    }
    if (existing.userId !== cmd.userId) {
      throw new ForbiddenError('FORBIDDEN', 'Hanya penulis yang boleh menghapus');
    }

    const ok = await this.repo.markCommentDeletedByAuthor(cmd.id, cmd.userId);
    if (!ok) {
      throw new NotFoundError('JINYE_COMMENT_NOT_FOUND', 'Komentar tidak ditemukan');
    }

    await this.repo.incrementPublishedCommentCount(existing.jinyeId, -1);

    await this.auditRepo.record({
      userId: cmd.userId,
      action: 'delete',
      entityType: 'jinye_comment',
      entityId: cmd.id,
      newData: { status: 'deleted_by_author' },
      requestId: cmd.requestId ?? null,
    });
  }
}
