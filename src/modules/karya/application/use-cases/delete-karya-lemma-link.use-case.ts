import type { AuditLogRepository } from '@/modules/audit/domain/repositories/audit-log.repository';
import { ForbiddenError, NotFoundError } from '@/shared/errors/app-error';
import type { KaryaRepositoryImpl } from '../../infrastructure/karya.repository.impl';

export class DeleteKaryaLemmaLinkUseCase {
  constructor(
    private readonly repo: KaryaRepositoryImpl,
    private readonly auditRepo: AuditLogRepository,
  ) {}

  async execute(input: {
    linkId: string;
    userId: string;
    isStaff?: boolean;
    requestId?: string | null;
  }): Promise<void> {
    const link = await this.repo.findLemmaLinkById(input.linkId);
    if (!link) {
      throw new NotFoundError(
        'KARYA_LEMMA_LINK_NOT_FOUND',
        'Tautan lemma tidak ditemukan',
      );
    }

    const ctx = await this.repo.findExcerptLemmaContext(link.excerptId);
    if (!ctx) {
      throw new NotFoundError(
        'KARYA_EXCERPT_NOT_FOUND',
        'Cuplikan tidak ditemukan',
      );
    }

    const isAuthor = ctx.authorId === input.userId;
    if (!isAuthor && !input.isStaff) {
      throw new ForbiddenError(
        'NOT_OWNER',
        'Hanya penulis cuplikan atau tim yang bisa menghapus tautan lemma',
      );
    }

    await this.repo.deleteLemmaLink(input.linkId);

    await this.auditRepo.record({
      userId: input.userId,
      action: 'delete',
      entityType: 'karya_lemma_link',
      entityId: input.linkId,
      oldData: {
        excerpt_id: link.excerptId,
        word_id: link.wordId,
        start: link.start,
        end: link.end,
      },
      requestId: input.requestId ?? null,
    });
  }
}