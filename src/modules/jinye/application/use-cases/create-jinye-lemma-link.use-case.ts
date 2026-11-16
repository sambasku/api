import type { AuditLogRepository } from '@/modules/audit/domain/repositories/audit-log.repository';
import type { WordRepository } from '@/modules/word/domain/repositories/word.repository';
import { assertCanContribute } from '@/modules/word/application/utils/assert-can-contribute';
import { NotFoundError, ValidationError } from '@/shared/errors/app-error';
import type { JinyeLemmaLink } from '../../domain/entities/jinye.entity';
import type { JinyeRepository } from '../../domain/repositories/jinye.repository';
import {
  assertNoOverlap,
  assertUnderLinkCap,
  assertValidSpan,
} from '../utils/jinye-lemma-span';

export class CreateJinyeLemmaLinkUseCase {
  constructor(
    private readonly repo: JinyeRepository,
    private readonly words: Pick<WordRepository, 'findById'>,
    private readonly auditRepo: AuditLogRepository,
  ) {}

  async execute(input: {
    jinyeId: string;
    userId: string;
    start: number;
    end: number;
    wordId: string;
    commentId?: string | null;
    requestId?: string | null;
  }): Promise<JinyeLemmaLink> {
    await assertCanContribute(input.userId);

    const jinye = await this.repo.findById(input.jinyeId);
    if (!jinye || jinye.status !== 'published') {
      throw new NotFoundError('JINYE_NOT_FOUND', 'Jinye tidak ditemukan');
    }

    const commentId = input.commentId ?? null;
    let spanBody = jinye.body;
    let sourceAuthorId = jinye.userId;

    if (commentId) {
      const comment = await this.repo.findCommentById(commentId);
      if (
        !comment ||
        comment.jinyeId !== input.jinyeId ||
        comment.status !== 'published'
      ) {
        throw new NotFoundError(
          'JINYE_COMMENT_NOT_FOUND',
          'Komentar tidak ditemukan',
        );
      }
      spanBody = comment.body;
      sourceAuthorId = comment.userId;
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
      commentId
        ? { commentId }
        : { jinyeId: input.jinyeId },
    );
    assertUnderLinkCap(existing.length);
    assertNoOverlap(input.start, input.end, existing);

    // ponytail: source bedakan kredit; status tetap active (bukan pending)
    const source = sourceAuthorId === input.userId ? 'author' : 'community';

    const created = await this.repo.createLemmaLink({
      jinyeId: input.jinyeId,
      commentId,
      start: input.start,
      end: input.end,
      wordId: input.wordId,
      source,
      status: 'active',
    });

    await this.auditRepo.record({
      userId: input.userId,
      action: 'create',
      entityType: 'jinye_lemma_link',
      entityId: created.id,
      newData: {
        jinye_id: input.jinyeId,
        comment_id: commentId,
        start: input.start,
        end: input.end,
        word_id: input.wordId,
      },
      requestId: input.requestId ?? null,
    });

    return created;
  }
}
