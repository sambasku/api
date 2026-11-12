import type { AuditLogRepository } from '@/modules/audit/domain/repositories/audit-log.repository';
import type { WordRepository } from '@/modules/word/domain/repositories/word.repository';
import { assertCanContribute } from '@/modules/word/application/utils/assert-can-contribute';
import {
  ConflictError,
  NotFoundError,
  ValidationError,
} from '@/shared/errors/app-error';
import type { JinyeLemmaLink } from '../../domain/entities/jinye.entity';
import type { JinyeRepository } from '../../domain/repositories/jinye.repository';

export class ProposeJinyeLemmaCorrectionUseCase {
  constructor(
    private readonly repo: JinyeRepository,
    private readonly words: Pick<WordRepository, 'findById'>,
    private readonly auditRepo: AuditLogRepository,
  ) {}

  async execute(input: {
    jinyeId: string;
    linkId: string;
    userId: string;
    wordId: string;
    requestId?: string | null;
  }): Promise<JinyeLemmaLink> {
    await assertCanContribute(input.userId);

    const jinye = await this.repo.findById(input.jinyeId);
    if (!jinye || jinye.status !== 'published') {
      throw new NotFoundError('JINYE_NOT_FOUND', 'Jinye tidak ditemukan');
    }

    const link = await this.repo.findLemmaLinkById(input.linkId);
    if (!link || link.jinyeId !== input.jinyeId) {
      throw new NotFoundError(
        'JINYE_LEMMA_LINK_NOT_FOUND',
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
        'JINYE_LEMMA_LINK_NOT_FOUND',
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
        'JINYE_LEMMA_LINK_NOT_FOUND',
        'Tautan lemma tidak ditemukan',
      );
    }

    await this.auditRepo.record({
      userId: input.userId,
      action: 'update',
      entityType: 'jinye_lemma_link',
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
