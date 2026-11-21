import type { AuditLogRepository } from '@/modules/audit/domain/repositories/audit-log.repository';
import type { WordRepository } from '@/modules/word/domain/repositories/word.repository';
import { assertCanContribute } from '@/modules/word/application/utils/assert-can-contribute';
import {
  assertNoOverlap,
  assertUnderLinkCap,
  assertValidSpan,
} from '@/modules/jinye/application/utils/jinye-lemma-span';
import { NotFoundError, ValidationError } from '@/shared/errors/app-error';
import type { KaryaLemmaLink } from '../../domain/karya';
import type { KaryaRepositoryImpl } from '../../infrastructure/karya.repository.impl';
import { assertExcerptLemmaEligible } from '../utils/assert-excerpt-lemma-eligible';

export class CreateKaryaLemmaLinkUseCase {
  constructor(
    private readonly repo: KaryaRepositoryImpl,
    private readonly words: Pick<WordRepository, 'findById'>,
    private readonly auditRepo: AuditLogRepository,
  ) {}

  async execute(input: {
    excerptId: string;
    userId: string;
    start: number;
    end: number;
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
    assertValidSpan(ctx.text, input.start, input.end);

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

    const existing = await this.repo.listActiveLemmaLinksForExcerpt(input.excerptId);
    assertUnderLinkCap(existing.length);
    assertNoOverlap(input.start, input.end, existing);

    const source = ctx.authorId === input.userId ? 'author' : 'community';

    const created = await this.repo.createLemmaLink({
      excerptId: input.excerptId,
      start: input.start,
      end: input.end,
      wordId: input.wordId,
      source,
      status: 'active',
    });

    await this.auditRepo.record({
      userId: input.userId,
      action: 'create',
      entityType: 'karya_lemma_link',
      entityId: created.id,
      newData: {
        excerpt_id: input.excerptId,
        start: input.start,
        end: input.end,
        word_id: input.wordId,
      },
      requestId: input.requestId ?? null,
    });

    return created;
  }
}