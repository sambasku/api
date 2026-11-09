import type { AuditLogRepository } from '@/modules/audit/domain/repositories/audit-log.repository';
import { BadRequestError, NotFoundError } from '@/shared/errors/app-error';
import type { Jinye } from '../../domain/entities/jinye.entity';
import type { JinyeRepository } from '../../domain/repositories/jinye.repository';

export class PinJinyeUseCase {
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
    if (row.status !== 'published') {
      throw new BadRequestError(
        'JINYE_NOT_PUBLISHED',
        'Hanya Jinye tayang yang bisa dipin. Pulihkan dari arsip dulu ya.',
      );
    }

    const prev = await this.repo.getPinnedJinyeId(input.userId);
    if (prev === input.id) return row;

    await this.repo.setPinnedJinyeId(input.userId, input.id);

    await this.auditRepo.record({
      userId: input.userId,
      action: 'update',
      entityType: 'jinye_pin',
      entityId: input.id,
      oldData: { pinned_jinye_id: prev },
      newData: { pinned_jinye_id: input.id },
      requestId: input.requestId ?? null,
    });

    return row;
  }
}
