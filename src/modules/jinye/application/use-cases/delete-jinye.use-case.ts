import type { AuditLogRepository } from '@/modules/audit/domain/repositories/audit-log.repository';
import { NotFoundError } from '@/shared/errors/app-error';
import type { JinyeRepository } from '../../domain/repositories/jinye.repository';

export class DeleteJinyeUseCase {
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
    const ok = await this.repo.markDeletedByAuthor(input.id, input.userId);
    if (!ok) {
      throw new NotFoundError('JINYE_NOT_FOUND', 'Jinye tidak ditemukan');
    }

    await this.auditRepo.record({
      userId: input.userId,
      action: 'delete',
      entityType: 'jinye',
      entityId: input.id,
      oldData: { status: row.status },
      newData: { status: 'deleted_by_author' },
      requestId: input.requestId ?? null,
    });
  }
}
