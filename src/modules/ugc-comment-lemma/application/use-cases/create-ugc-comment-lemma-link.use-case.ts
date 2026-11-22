import type { AuditLogRepository } from '@/modules/audit/domain/repositories/audit-log.repository';
import type { WordRepository } from '@/modules/word/domain/repositories/word.repository';
import { assertCanContribute } from '@/modules/word/application/utils/assert-can-contribute';
import {
  assertNoOverlap,
  assertUnderLinkCap,
  assertValidSpan,
} from '@/shared/span-lemma/span-lemma';
import type { AppDatabase } from '@/shared/database/drizzle/client';
import type { UgcCommentAnchorKind } from '@/shared/database/drizzle/schema/ugc-comment-lemma-links.schema';
import { ValidationError } from '@/shared/errors/app-error';
import type { UgcCommentLemmaLink } from '../../domain/entities/ugc-comment-lemma.entity';
import type { UgcCommentLemmaRepository } from '../../domain/repositories/ugc-comment-lemma.repository';
import {
  assertCommentPublished,
  resolveUgcCommentAnchor,
} from '../utils/resolve-ugc-comment-anchor';

export class CreateUgcCommentLemmaLinkUseCase {
  constructor(
    private readonly db: AppDatabase,
    private readonly repo: UgcCommentLemmaRepository,
    private readonly words: Pick<WordRepository, 'findById'>,
    private readonly auditRepo: AuditLogRepository,
  ) {}

  async execute(input: {
    anchorKind: UgcCommentAnchorKind;
    hostId: string;
    commentId: string;
    userId: string;
    start: number;
    end: number;
    wordId: string;
    requestId?: string | null;
  }): Promise<UgcCommentLemmaLink> {
    await assertCanContribute(input.userId);

    const resolved = await resolveUgcCommentAnchor(this.db, {
      anchorKind: input.anchorKind,
      hostId: input.hostId,
      commentId: input.commentId,
    });
    await assertCommentPublished(resolved);
    assertValidSpan(resolved.body, input.start, input.end);

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

    const existing = await this.repo.listActiveForComment(
      input.anchorKind,
      input.commentId,
    );
    assertUnderLinkCap(existing.length);
    assertNoOverlap(input.start, input.end, existing);

    const source =
      resolved.authorId === input.userId ? ('author' as const) : ('community' as const);

    const link = await this.repo.create({
      anchorKind: input.anchorKind,
      hostId: input.hostId,
      commentId: input.commentId,
      start: input.start,
      end: input.end,
      wordId: input.wordId,
      source,
    });

    await this.auditRepo.record({
      userId: input.userId,
      action: 'create',
      entityType: 'ugc_comment_lemma_link',
      entityId: link.id,
      newData: {
        anchor_kind: input.anchorKind,
        host_id: input.hostId,
        comment_id: input.commentId,
        start: input.start,
        end: input.end,
        word_id: input.wordId,
      },
      requestId: input.requestId ?? null,
    });

    return link;
  }
}