import type { AuditLogRepository } from '@/modules/audit/domain/repositories/audit-log.repository';
import { NotFoundError, ValidationError } from '@/shared/errors/app-error';
import type { JinyeLemmaLink } from '../../domain/entities/jinye.entity';
import type { JinyeRepository } from '../../domain/repositories/jinye.repository';

export class ResolveJinyeLemmaCorrectionUseCase {
  constructor(
    private readonly repo: JinyeRepository,
    private readonly auditRepo: AuditLogRepository,
  ) {}

  async execute(input: {
    jinyeId: string;
    linkId: string;
    reviewerId: string;
    action: 'approve' | 'reject';
    requestId?: string | null;
  }): Promise<JinyeLemmaLink> {
    const link = await this.repo.findLemmaLinkById(input.linkId);
    if (!link || link.jinyeId !== input.jinyeId) {
      throw new NotFoundError(
        'JINYE_LEMMA_LINK_NOT_FOUND',
        'Tautan lemma tidak ditemukan',
      );
    }
    if (link.status !== 'pending_correction' || !link.proposedWordId) {
      throw new ValidationError([
        {
          field: 'action',
          message: 'Tidak ada usulan koreksi yang menunggu',
        },
      ]);
    }

    const now = new Date();
    const updated =
      input.action === 'approve'
        ? await this.repo.updateLemmaLink(input.linkId, {
            wordId: link.proposedWordId,
            status: 'active',
            source: 'correction',
            proposedWordId: null,
            proposedBy: null,
            reviewedBy: input.reviewerId,
            reviewedAt: now,
          })
        : await this.repo.updateLemmaLink(input.linkId, {
            status: 'active',
            source: 'author',
            proposedWordId: null,
            proposedBy: null,
            reviewedBy: input.reviewerId,
            reviewedAt: now,
          });

    if (!updated) {
      throw new NotFoundError(
        'JINYE_LEMMA_LINK_NOT_FOUND',
        'Tautan lemma tidak ditemukan',
      );
    }

    await this.auditRepo.record({
      userId: input.reviewerId,
      action: 'update',
      entityType: 'jinye_lemma_link',
      entityId: input.linkId,
      oldData: {
        word_id: link.wordId,
        proposed_word_id: link.proposedWordId,
        status: 'pending_correction',
      },
      newData: {
        action: input.action,
        word_id: updated.wordId,
        status: updated.status,
      },
      requestId: input.requestId ?? null,
    });

    return updated;
  }
}
