import { ConflictError, ForbiddenError, NotFoundError } from '@/shared/errors/app-error';
import type { AuditLogRepository } from '@/modules/audit/domain/repositories/audit-log.repository';
import type { WordRepository } from '../../domain/repositories/word.repository';
import type { Actor } from './create-word.use-case';

const DELETE_ROLES = new Set(['admin', 'root', 'reviewer']);

export interface SoftDeleteMeaningResult {
  meaningId: string;
  wordId: string;
  definition: string;
}

/**
 * Soft-delete satu makna tayang (#253). Role di use-case (admin/root/reviewer).
 * Tolak jika ini makna hidup terakhir pada kata.
 */
export class SoftDeleteMeaningUseCase {
  constructor(
    private readonly wordRepo: WordRepository,
    private readonly auditRepo: AuditLogRepository,
    private readonly onDeleted?: (input: {
      wordId: string;
      meaningId: string;
      actorId: string;
      requestId?: string | null;
    }) => Promise<void>,
  ) {}

  async execute(
    wordId: string,
    meaningId: string,
    actor: Actor,
  ): Promise<SoftDeleteMeaningResult> {
    const roles = actor.roles?.length ? actor.roles : [actor.role];
    if (!roles.some((r) => DELETE_ROLES.has(r))) {
      throw new ForbiddenError(
        'FORBIDDEN',
        'Hanya verifikator (admin/reviewer) yang boleh menghapus makna',
      );
    }

    const word = await this.wordRepo.findById(wordId);
    if (!word) {
      throw new NotFoundError('WORD_NOT_FOUND', 'Kata dengan id tersebut tidak ditemukan');
    }

    const meaning = await this.wordRepo.findMeaningById(meaningId);
    if (!meaning || meaning.wordId !== wordId) {
      throw new NotFoundError('MEANING_NOT_FOUND', 'Makna tidak ditemukan pada kata ini');
    }

    const liveCount = await this.wordRepo.countLiveMeanings(wordId);
    if (liveCount <= 1) {
      throw new ConflictError(
        'LAST_MEANING',
        'Tidak bisa menghapus makna terakhir. Tarik entri atau usulkan perbaikan.',
      );
    }

    const deleted = await this.wordRepo.softDeleteMeaning(wordId, meaningId, actor.userId);
    if (!deleted) {
      throw new NotFoundError('MEANING_NOT_FOUND', 'Makna tidak ditemukan pada kata ini');
    }

    await this.auditRepo.record({
      userId: actor.userId,
      action: 'delete',
      entityType: 'meaning',
      entityId: meaningId,
      oldData: {
        word_id: wordId,
        lemma: word.lemma,
        definition: deleted.definition,
      },
      requestId: actor.requestId ?? null,
    });

    if (this.onDeleted) {
      await this.onDeleted({
        wordId,
        meaningId,
        actorId: actor.userId,
        requestId: actor.requestId ?? null,
      });
    }

    return { meaningId, wordId, definition: deleted.definition };
  }
}
