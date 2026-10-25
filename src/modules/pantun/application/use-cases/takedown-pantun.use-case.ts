import { NotFoundError } from '@/shared/errors/app-error';
import type { AuditLogRepository } from '@/modules/audit/domain/repositories/audit-log.repository';
import type { Pantun } from '../../domain/entities/pantun.entity';
import type { PantunRepository } from '../../domain/repositories/pantun.repository';

export class TakedownPantunUseCase {
  constructor(
    private readonly repo: PantunRepository,
    private readonly auditRepo: AuditLogRepository,
  ) {}
  async execute(cmd: { id: string; actorId: string; requestId?: string | null }): Promise<Pantun> {
    const row = await this.repo.takedown(cmd.id, cmd.actorId);
    if (!row) {
      throw new NotFoundError('PANTUN_NOT_FOUND', 'Pantun tidak ditemukan');
    }
    await this.auditRepo.record({
      userId: cmd.actorId,
      action: 'takedown',
      entityType: 'pantun',
      entityId: cmd.id,
      oldData: { status: 'published' },
      newData: { status: 'taken_down' },
      requestId: cmd.requestId ?? null,
    });
    return row;
  }
}
