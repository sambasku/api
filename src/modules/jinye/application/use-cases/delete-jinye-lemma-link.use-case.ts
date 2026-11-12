import type { AuditLogRepository } from '@/modules/audit/domain/repositories/audit-log.repository';
import { ForbiddenError, NotFoundError } from '@/shared/errors/app-error';
import type { JinyeRepository } from '../../domain/repositories/jinye.repository';

export class DeleteJinyeLemmaLinkUseCase {
  constructor(
    private readonly repo: JinyeRepository,
    private readonly auditRepo: AuditLogRepository,
  ) {}

  async execute(input: {
    jinyeId: string;
    linkId: string;
    userId: string;
    isStaff?: boolean;
    requestId?: string | null;
  }): Promise<void> {
    const jinye = await this.repo.findById(input.jinyeId);
    if (!jinye) {
      throw new NotFoundError('JINYE_NOT_FOUND', 'Jinye tidak ditemukan');
    }

    const link = await this.repo.findLemmaLinkById(input.linkId);
    if (!link || link.jinyeId !== input.jinyeId) {
      throw new NotFoundError(
        'JINYE_LEMMA_LINK_NOT_FOUND',
        'Tautan lemma tidak ditemukan',
      );
    }

    const isOwner = jinye.userId === input.userId;
    if (!isOwner && !input.isStaff) {
      throw new ForbiddenError(
        'NOT_OWNER',
        'Hanya penulis atau tim yang bisa menghapus tautan lemma',
      );
    }

    await this.repo.deleteLemmaLink(input.linkId);

    await this.auditRepo.record({
      userId: input.userId,
      action: 'delete',
      entityType: 'jinye_lemma_link',
      entityId: input.linkId,
      oldData: {
        jinye_id: input.jinyeId,
        word_id: link.wordId,
        start: link.start,
        end: link.end,
      },
      requestId: input.requestId ?? null,
    });
  }
}
