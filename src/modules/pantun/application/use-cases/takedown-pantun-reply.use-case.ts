import { NotFoundError } from '@/shared/errors/app-error';
import type { AuditLogRepository } from '@/modules/audit/domain/repositories/audit-log.repository';
import type { PantunRepository } from '../../domain/repositories/pantun.repository';

export class TakedownPantunReplyUseCase {
  constructor(
    private readonly repo: PantunRepository,
    private readonly auditRepo: AuditLogRepository,
  ) {}
  async execute(cmd: { replyId: string; actorId: string; requestId?: string | null }): Promise<void> {
    const ok = await this.repo.takedownReply(cmd.replyId, cmd.actorId);
    if (!ok) {
      throw new NotFoundError('PANTUN_REPLY_NOT_FOUND', 'Balasan tidak ditemukan');
    }
    await this.auditRepo.record({
      userId: cmd.actorId,
      action: 'takedown',
      entityType: 'pantun_reply',
      entityId: cmd.replyId,
      oldData: { status: 'published' },
      newData: { status: 'taken_down' },
      requestId: cmd.requestId ?? null,
    });
  }
}
