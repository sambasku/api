import type { AuditLogRepository } from '@/modules/audit/domain/repositories/audit-log.repository';
import type { WordRepository } from '@/modules/word/domain/repositories/word.repository';
import { LEMMA_EXAMPLE_TRANSLATION_REFF } from '@/shared/database/drizzle/schema';
import { ConflictError, NotFoundError, ValidationError } from '@/shared/errors/app-error';
import type { Translation } from '../../domain/entities/translation.entity';
import type { TranslationRepository } from '../../domain/repositories/translation.repository';

export type ResolveTranslationAction = 'approve' | 'reject';

export class ResolveTranslationUseCase {
  constructor(
    private readonly translationRepo: TranslationRepository,
    private readonly auditRepo: AuditLogRepository,
    private readonly words: Pick<
      WordRepository,
      'findExampleById' | 'applyExampleTargetSentence' | 'findLanguageIdByCode'
    >,
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

    // lemma_example: approve → tulis ke examples.target_sentence.
    if (
      input.action === 'approve' &&
      row.reff === LEMMA_EXAMPLE_TRANSLATION_REFF
    ) {
      await this.applyToLemmaExample(row.reffId, row.body, input.reviewerId);
    }

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

  private async applyToLemmaExample(
    exampleId: string,
    targetSentence: string,
    reviewerId: string,
  ): Promise<void> {
    const example = await this.words.findExampleById(exampleId);
    if (!example) {
      throw new NotFoundError(
        'EXAMPLE_NOT_FOUND',
        'Contoh kalimat tidak ditemukan',
      );
    }
    const targetLanguageId = await this.words.findLanguageIdByCode('id');
    if (!targetLanguageId) {
      throw new ValidationError([
        {
          field: 'target_sentence',
          message: 'Bahasa Indonesia belum tersedia di sistem.',
        },
      ]);
    }
    const applied = await this.words.applyExampleTargetSentence(
      exampleId,
      { targetSentence: targetSentence.trim(), targetLanguageId },
      reviewerId,
    );
    if (!applied) {
      throw new NotFoundError(
        'EXAMPLE_NOT_FOUND',
        'Contoh kalimat tidak ditemukan',
      );
    }
  }
}
