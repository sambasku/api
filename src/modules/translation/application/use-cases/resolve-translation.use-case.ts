import type { AuditLogRepository } from '@/modules/audit/domain/repositories/audit-log.repository';
import { ConflictError, NotFoundError } from '@/shared/errors/app-error';
import type { Translation } from '../../domain/entities/translation.entity';
import type { TranslationRepository } from '../../domain/repositories/translation.repository';

export type ResolveTranslationAction = 'approve' | 'reject';

export class ResolveTranslationUseCase {
  constructor(
    private readonly translationRepo: TranslationRepository,
    private readonly auditRepo: AuditLogRepository,
  ) {}

  async execute(input: {
    id: string;
    action: ResolveTranslationAction;
    reviewerId: string;
    requestId?: string | null;
  }): Promise<Translation> {
    // Role gate di route (authorizeRole verifikator).
    const row = await this.translationRepo.findById(input.id);
    if (!row) {
      throw new NotFoundError(
        'TRANSLATION_NOT_FOUND',
        'Usulan terjemahan tidak ditemukan',
      );
    }
    if (row.status !== 'pending') {
      throw new ConflictError(
        'TRANSLATION_NOT_PENDING',
        'Usulan ini sudah diproses.',
      );
    }

    if (input.action === 'approve') {
      const prev = await this.translationRepo.findAccepted(
        row.reff,
        row.reffId,
      );
      if (prev) {
        await this.translationRepo.updateStatus(
          prev.id,
          'rejected',
          input.reviewerId,
        );
      }
    }

    const status = input.action === 'approve' ? 'accepted' : 'rejected';
    const updated = await this.translationRepo.updateStatus(
      row.id,
      status,
      input.reviewerId,
    );

    await this.auditRepo.record({
      userId: input.reviewerId,
      action: 'update',
      entityType: 'translation',
      entityId: row.id,
      newData: { action: input.action, status },
      requestId: input.requestId ?? null,
    });

    return updated;
  }
}
