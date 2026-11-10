import { NotFoundError } from '@/shared/errors/app-error';
import type { AuditLogRepository } from '@/modules/audit/domain/repositories/audit-log.repository';
import type { JinyeRepository } from '../../domain/repositories/jinye.repository';

export class TakedownJinyeCommentUseCase {
  constructor(
    private readonly repo: JinyeRepository,
    private readonly auditRepo: AuditLogRepository,
  ) {}

  async execute(cmd: {
    commentId: string;
    actorId: string;
    requestId?: string | null;
  }): Promise<void> {
    const ok = await this.repo.takedownComment(cmd.commentId, cmd.actorId);
    if (!ok) {
      throw new NotFoundError(
        'JINYE_COMMENT_NOT_FOUND',
        'Komentar Jinye tidak ditemukan',
      );
    }
    await this.auditRepo.record({
      userId: cmd.actorId,
      action: 'takedown',
      entityType: 'jinye_comment',
      entityId: cmd.commentId,
      oldData: { status: 'published' },
      newData: { status: 'taken_down' },
      requestId: cmd.requestId ?? null,
    });
  }
}
