import type { AuditLogRepository } from '@/modules/audit/domain/repositories/audit-log.repository';
import { assertCanContribute } from '@/modules/word/application/utils/assert-can-contribute';
import {
  ConflictError,
  NotFoundError,
  ValidationError,
} from '@/shared/errors/app-error';
import type { JinyeTranslation } from '../../domain/entities/jinye.entity';
import type { JinyeRepository } from '../../domain/repositories/jinye.repository';

export class CreateJinyeTranslationUseCase {
  constructor(
    private readonly repo: JinyeRepository,
    private readonly auditRepo: AuditLogRepository,
  ) {}

  async execute(input: {
    jinyeId: string;
    userId: string;
    bodyId: string;
    requestId?: string | null;
  }): Promise<JinyeTranslation> {
    await assertCanContribute(input.userId);

    const bodyId = input.bodyId.trim();
    if (bodyId.length === 0 || bodyId.length > 1000) {
      throw new ValidationError([
        {
          field: 'body_id',
          message: 'Terjemahan wajib diisi (maks 1000 karakter).',
        },
      ]);
    }

    const jinye = await this.repo.findById(input.jinyeId);
    if (!jinye || jinye.status !== 'published') {
      throw new NotFoundError('JINYE_NOT_FOUND', 'Jinye tidak ditemukan');
    }
    if (jinye.body.trim().length === 0) {
      throw new ValidationError([
        {
          field: 'body_id',
          message: 'Jinye tanpa teks tidak perlu terjemahan.',
        },
      ]);
    }

    const existingPending = await this.repo.findPendingTranslationByTranslator(
      input.jinyeId,
      input.userId,
    );
    if (existingPending) {
      throw new ConflictError(
        'JINYE_TRANSLATION_PENDING',
        'Kamu masih punya usulan terjemahan yang menunggu tinjauan untuk Jinye ini.',
      );
    }

    const created = await this.repo.createTranslation({
      jinyeId: input.jinyeId,
      bodyId,
      translatorId: input.userId,
    });

    await this.auditRepo.record({
      userId: input.userId,
      action: 'create',
      entityType: 'jinye_translation',
      entityId: created.id,
      newData: { jinye_id: input.jinyeId, body_id: bodyId },
      requestId: input.requestId ?? null,
    });

    return created;
  }
}
