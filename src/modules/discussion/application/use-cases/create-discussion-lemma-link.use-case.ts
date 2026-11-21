import type { AuditLogRepository } from '@/modules/audit/domain/repositories/audit-log.repository';
import type { WordRepository } from '@/modules/word/domain/repositories/word.repository';
import { assertCanContribute } from '@/modules/word/application/utils/assert-can-contribute';
import {
  assertNoOverlap,
  assertUnderLinkCap,
  assertValidSpan,
} from '@/modules/jinye/application/utils/jinye-lemma-span';
import { NotFoundError, ValidationError } from '@/shared/errors/app-error';
import type { DiscussionLemmaLink } from '../../domain/entities/discussion.entity';
import type { DiscussionRepository } from '../../domain/repositories/discussion.repository';

export class CreateDiscussionLemmaLinkUseCase {
  constructor(
    private readonly repo: DiscussionRepository,
    private readonly words: Pick<WordRepository, 'findById'>,
    private readonly auditRepo: AuditLogRepository,
  ) {}

  async execute(input: {
    discussionId: string;
    userId: string;
    start: number;
    end: number;
    wordId: string;
    replyId?: string | null;
    requestId?: string | null;
  }): Promise<DiscussionLemmaLink> {
    await assertCanContribute(input.userId);

    const help = await this.repo.findById(input.discussionId);
    if (!help || help.status !== 'published') {
      throw new NotFoundError('DISCUSSION_NOT_FOUND', 'Diskusi tidak ditemukan');
    }

    const replyId = input.replyId ?? null;
    let spanBody = help.body ?? '';
    let sourceAuthorId = help.userId;

    if (replyId) {
      const reply = await this.repo.findReplyById(replyId);
      if (
        !reply ||
        reply.discussionId !== input.discussionId ||
        reply.status !== 'published'
      ) {
        throw new NotFoundError(
          'DISCUSSION_REPLY_NOT_FOUND',
          'Balasan tidak ditemukan',
        );
      }
      spanBody = reply.body;
      sourceAuthorId = reply.userId;
    }

    assertValidSpan(spanBody, input.start, input.end);

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

    const existing = await this.repo.listActiveLemmaLinksForTarget(
      replyId
        ? { replyId }
        : { discussionId: input.discussionId },
    );
    assertUnderLinkCap(existing.length);
    assertNoOverlap(input.start, input.end, existing);

    const source = sourceAuthorId === input.userId ? 'author' : 'community';

    const created = await this.repo.createLemmaLink({
      discussionId: input.discussionId,
      replyId,
      start: input.start,
      end: input.end,
      wordId: input.wordId,
      source,
      status: 'active',
    });

    await this.auditRepo.record({
      userId: input.userId,
      action: 'create',
      entityType: 'discussion_lemma_link',
      entityId: created.id,
      newData: {
        discussion_id: input.discussionId,
        reply_id: replyId,
        start: input.start,
        end: input.end,
        word_id: input.wordId,
      },
      requestId: input.requestId ?? null,
    });

    return created;
  }
}
