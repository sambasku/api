import type { AuditLogRepository } from '@/modules/audit/domain/repositories/audit-log.repository';
import { NotFoundError } from '@/shared/errors/app-error';
import type { JinyeRepository } from '../../domain/repositories/jinye.repository';

export class UnpinJinyeUseCase {
  constructor(
    private readonly repo: JinyeRepository,
    private readonly auditRepo: AuditLogRepository,
  ) {}

  async execute(input: {
    id: string;
    userId: string;
    requestId?: string | null;
  }): Promise<void> {
    const row = await this.repo.findById(input.id);
    if (!row || row.userId !== input.userId) {
      throw new NotFoundError('JINYE_NOT_FOUND', 'Jinye tidak ditemukan');
    }

    const prev = await this.repo.getPinnedJinyeId(input.userId);
    if (prev !== input.id) return;

    await this.repo.setPinnedJinyeId(input.userId, null);

    await this.auditRepo.record({
      userId: input.userId,
      action: 'update',
      entityType: 'jinye_pin',
      entityId: input.id,
      oldData: { pinned_jinye_id: prev },
      newData: { pinned_jinye_id: null },
      requestId: input.requestId ?? null,
    });
  }
}
