import type { AuditLogRepository } from '@/modules/audit/domain/repositories/audit-log.repository';
import type { WordRepository } from '@/modules/word/domain/repositories/word.repository';
import { assertCanContribute } from '@/modules/word/application/utils/assert-can-contribute';
import {
  ConflictError,
  NotFoundError,
  ValidationError,
} from '@/shared/errors/app-error';
import type { KaryaLemmaLink } from '../../domain/karya';
import type { KaryaRepositoryImpl } from '../../infrastructure/karya.repository.impl';
import { assertExcerptLemmaEligible } from '../utils/assert-excerpt-lemma-eligible';

export class ProposeKaryaLemmaCorrectionUseCase {
  constructor(
    private readonly repo: KaryaRepositoryImpl,
    private readonly words: Pick<WordRepository, 'findById'>,
    private readonly auditRepo: AuditLogRepository,
  ) {}

  async execute(input: {
    excerptId: string;
    linkId: string;
    userId: string;
    wordId: string;
    requestId?: string | null;
  }): Promise<KaryaLemmaLink> {
    await assertCanContribute(input.userId);

    const ctx = await this.repo.findExcerptLemmaContext(input.excerptId);
    if (!ctx) {
      throw new NotFoundError(
        'KARYA_EXCERPT_NOT_FOUND',
        'Cuplikan tidak ditemukan',
      );
    }
    assertExcerptLemmaEligible(ctx);

    const link = await this.repo.findLemmaLinkById(input.linkId);
    if (!link || link.excerptId !== input.excerptId) {
      throw new NotFoundError(
        'KARYA_LEMMA_LINK_NOT_FOUND',
        'Tautan lemma tidak ditemukan',
      );
    }
    if (link.status === 'pending_correction') {
      throw new ConflictError(
        'CORRECTION_PENDING',
        'Sudah ada usulan koreksi yang menunggu tinjauan',
      );
    }
    if (link.status !== 'active') {
      throw new NotFoundError(
        'KARYA_LEMMA_LINK_NOT_FOUND',
        'Tautan lemma tidak ditemukan',
      );
    }
    if (link.wordId === input.wordId) {
      throw new ValidationError([
        {
          field: 'word_id',
          message: 'Pilih lemma yang berbeda dari yang sekarang ya.',
        },
      ]);
    }

    const word = await this.words.findById(input.wordId);
    if (
      !word ||
      word.status !== 'published' ||
      !word.isVerified ||
      word.deletedAt
    ) {
      throw new ValidationError([
        {
          field: 'word_id',
          message: 'Pilih kata yang sudah tayang dan terverifikasi ya.',
        },
      ]);
    }

    const updated = await this.repo.updateLemmaLink(input.linkId, {
      status: 'pending_correction',
      source: 'correction',
      proposedWordId: input.wordId,
      proposedBy: input.userId,
    });
    if (!updated) {
      throw new NotFoundError(
        'KARYA_LEMMA_LINK_NOT_FOUND',
        'Tautan lemma tidak ditemukan',
      );
    }

    await this.auditRepo.record({
      userId: input.userId,
      action: 'update',
      entityType: 'karya_lemma_link',
      entityId: input.linkId,
      oldData: { word_id: link.wordId, status: 'active' },
      newData: {
        proposed_word_id: input.wordId,
        status: 'pending_correction',
      },
      requestId: input.requestId ?? null,
    });

    return updated;
  }
}