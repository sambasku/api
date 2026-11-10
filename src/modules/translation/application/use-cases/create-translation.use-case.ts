import type { AuditLogRepository } from '@/modules/audit/domain/repositories/audit-log.repository';
import type { JinyeRepository } from '@/modules/jinye/domain/repositories/jinye.repository';
import { assertCanContribute } from '@/modules/word/application/utils/assert-can-contribute';
import {
  TRANSLATION_REFFS,
  type TranslationReff,
} from '@/shared/database/drizzle/schema';
import {
  BadRequestError,
  ConflictError,
  NotFoundError,
  ValidationError,
} from '@/shared/errors/app-error';
import type { Translation } from '../../domain/entities/translation.entity';
import type { TranslationRepository } from '../../domain/repositories/translation.repository';

export type CreateTranslationInput = {
  reff: string;
  reffId: string;
  body: string;
  translatorId: string;
  requestId?: string | null;
};

function isAllowedReff(reff: string): reff is TranslationReff {
  return (TRANSLATION_REFFS as readonly string[]).includes(reff);
}

export class CreateTranslationUseCase {
  constructor(
    private readonly translationRepo: TranslationRepository,
    private readonly jinyeRepo: JinyeRepository,
    private readonly auditRepo: AuditLogRepository,
  ) {}

  async execute(input: CreateTranslationInput): Promise<Translation> {
    if (!isAllowedReff(input.reff)) {
      throw new BadRequestError(
        'TRANSLATION_REFF_UNSUPPORTED',
        'reff tidak didukung',
      );
    }

    await assertCanContribute(input.translatorId);

    const body = input.body.trim();
    if (body.length === 0 || body.length > 1000) {
      throw new ValidationError([
        {
          field: 'body',
          message: 'Terjemahan wajib diisi (maks 1000 karakter).',
        },
      ]);
    }

    if (input.reff === 'jinye') {
      const target = await this.jinyeRepo.findById(input.reffId);
      if (!target || target.status !== 'published') {
        throw new NotFoundError('JINYE_NOT_FOUND', 'Jinye tidak ditemukan');
      }
      if (target.body.trim().length === 0) {
        throw new ValidationError([
          {
            field: 'body',
            message: 'Jinye tanpa teks tidak perlu terjemahan.',
          },
        ]);
      }
    }

    const existing = await this.translationRepo.findPendingByTranslator(
      input.reff,
      input.reffId,
      input.translatorId,
    );
    if (existing) {
      throw new ConflictError(
        'TRANSLATION_PENDING',
        'Kamu masih punya usulan terjemahan yang menunggu tinjauan.',
      );
    }

    const created = await this.translationRepo.create({
      reff: input.reff,
      reffId: input.reffId,
      body,
      translatorId: input.translatorId,
    });

    await this.auditRepo.record({
      userId: input.translatorId,
      action: 'create',
      entityType: 'translation',
      entityId: created.id,
      newData: { reff: input.reff, reff_id: input.reffId, body },
      requestId: input.requestId ?? null,
    });

    return created;
  }
}
