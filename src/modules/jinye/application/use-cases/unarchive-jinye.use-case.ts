import type { AuditLogRepository } from '@/modules/audit/domain/repositories/audit-log.repository';
import { NotFoundError } from '@/shared/errors/app-error';
import type { Jinye } from '../../domain/entities/jinye.entity';
import type { JinyeRepository } from '../../domain/repositories/jinye.repository';

export class UnarchiveJinyeUseCase {
  constructor(
    private readonly repo: JinyeRepository,
    private readonly auditRepo: AuditLogRepository,
  ) {}

  async execute(input: {
    id: string;
    userId: string;
    requestId?: string | null;
  }): Promise<Jinye> {
    const row = await this.repo.findById(input.id);
    if (!row || row.userId !== input.userId) {
      throw new NotFoundError('JINYE_NOT_FOUND', 'Jinye tidak ditemukan');
    }
    if (row.status === 'published') return row;
    if (row.status !== 'archived') {
      throw new NotFoundError('JINYE_NOT_FOUND', 'Jinye tidak ditemukan');
    }

    const updated = await this.repo.setStatus({
      id: input.id,
      userId: input.userId,
      from: 'archived',
      to: 'published',
    });
    if (!updated) {
      throw new NotFoundError('JINYE_NOT_FOUND', 'Jinye tidak ditemukan');
    }

    await this.auditRepo.record({
      userId: input.userId,
      action: 'update',
      entityType: 'jinye',
      entityId: input.id,
      oldData: { status: 'archived' },
      newData: { status: 'published' },
      requestId: input.requestId ?? null,
    });

    return updated;
  }
}
