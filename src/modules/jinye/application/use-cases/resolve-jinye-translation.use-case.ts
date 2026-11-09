import type { AuditLogRepository } from '@/modules/audit/domain/repositories/audit-log.repository';
import {
  ConflictError,
  NotFoundError,
  ValidationError,
} from '@/shared/errors/app-error';
import type { JinyeTranslation } from '../../domain/entities/jinye.entity';
import type { JinyeRepository } from '../../domain/repositories/jinye.repository';

export class ResolveJinyeTranslationUseCase {
  constructor(
    private readonly repo: JinyeRepository,
    private readonly auditRepo: AuditLogRepository,
  ) {}

  async execute(input: {
    jinyeId: string;
    translationId: string;
    reviewerId: string;
    action: 'approve' | 'reject';
    requestId?: string | null;
  }): Promise<JinyeTranslation> {
    const jinye = await this.repo.findById(input.jinyeId);
    if (!jinye || jinye.status !== 'published') {
      throw new NotFoundError('JINYE_NOT_FOUND', 'Jinye tidak ditemukan');
    }

    const row = await this.repo.findTranslationById(input.translationId);
    if (!row || row.jinyeId !== input.jinyeId) {
      throw new NotFoundError(
        'JINYE_TRANSLATION_NOT_FOUND',
        'Usulan terjemahan tidak ditemukan',
      );
    }
    if (row.status !== 'pending') {
      throw new ConflictError(
        'JINYE_TRANSLATION_NOT_PENDING',
        'Usulan ini sudah diproses.',
      );
    }

    if (input.action === 'approve') {
      const accepted = await this.repo.findAcceptedTranslation(input.jinyeId);
      if (accepted) {
        // Satu accepted: reject yang lama dulu (supersede).
        await this.repo.updateTranslation(accepted.id, {
          status: 'rejected',
          reviewedBy: input.reviewerId,
          reviewedAt: new Date(),
        });
      }
    }

    const status = input.action === 'approve' ? 'accepted' : 'rejected';
    const updated = await this.repo.updateTranslation(row.id, {
      status,
      reviewedBy: input.reviewerId,
      reviewedAt: new Date(),
    });
    if (!updated) {
      throw new ValidationError([
        { field: 'translation_id', message: 'Gagal memproses usulan.' },
      ]);
    }

    await this.auditRepo.record({
      userId: input.reviewerId,
      action: 'update',
      entityType: 'jinye_translation',
      entityId: row.id,
      newData: { action: input.action, status },
      requestId: input.requestId ?? null,
    });

    return updated;
  }
}
