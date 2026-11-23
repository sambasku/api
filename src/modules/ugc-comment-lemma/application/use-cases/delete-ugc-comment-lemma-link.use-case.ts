import type { AuditLogRepository } from '@/modules/audit/domain/repositories/audit-log.repository';
import { assertCanContribute } from '@/modules/word/application/utils/assert-can-contribute';
import type { AppDatabase } from '@/shared/database/drizzle/client';
import type { UgcCommentAnchorKind } from '@/shared/database/drizzle/schema/ugc-comment-lemma-links.schema';
import { ForbiddenError, NotFoundError } from '@/shared/errors/app-error';
import type { UgcCommentLemmaRepository } from '../../domain/repositories/ugc-comment-lemma.repository';
import {
  assertCommentPublished,
  resolveUgcCommentAnchor,
} from '../utils/resolve-ugc-comment-anchor';

export class DeleteUgcCommentLemmaLinkUseCase {
  constructor(
    private readonly db: AppDatabase,
    private readonly repo: UgcCommentLemmaRepository,
    private readonly auditRepo: AuditLogRepository,
  ) {}

  async execute(input: {
    anchorKind: UgcCommentAnchorKind;
    hostId: string;
    commentId: string;
    linkId: string;
    userId: string;
    isStaff: boolean;
    requestId?: string | null;
  }): Promise<void> {
    await assertCanContribute(input.userId);

    const link = await this.repo.findById(input.linkId);
    if (
      !link ||
      link.anchorKind !== input.anchorKind ||
      link.hostId !== input.hostId ||
      link.commentId !== input.commentId
    ) {
      throw new NotFoundError('LEMMA_LINK_NOT_FOUND', 'Tautan lemma tidak ditemukan');
    }

    const resolved = await resolveUgcCommentAnchor(this.db, {
      anchorKind: input.anchorKind,
      hostId: input.hostId,
      commentId: input.commentId,
    });
    await assertCommentPublished(resolved);

    const canDelete = input.isStaff || resolved.authorId === input.userId;
    if (!canDelete) {
      throw new ForbiddenError(
        'FORBIDDEN',
        'Kamu tidak boleh menghapus tautan lemma ini.',
      );
    }

    const ok = await this.repo.deleteById(input.linkId);
    if (!ok) {
      throw new NotFoundError('LEMMA_LINK_NOT_FOUND', 'Tautan lemma tidak ditemukan');
    }

    await this.auditRepo.record({
      userId: input.userId,
      action: 'delete',
      entityType: 'ugc_comment_lemma_link',
      entityId: input.linkId,
      oldData: { anchor_kind: input.anchorKind, host_id: input.hostId },
      requestId: input.requestId ?? null,
    });
  }
}