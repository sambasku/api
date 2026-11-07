import { ConflictError, NotFoundError } from '@/shared/errors/app-error';
import type { AuditLogRepository } from '@/modules/audit/domain/repositories/audit-log.repository';
import type { SyncLiveWordContributionsUseCase } from '@/modules/contribution/application/use-cases/sync-live-word-contributions.use-case';
import type { WordRepository } from '../../domain/repositories/word.repository';

export interface PublishWordCommand {
  wordId: string;
  /** true = tayang (status published); false = tarik (status draft) */
  published: boolean;
  actorId: string;
  requestId?: string | null;
}

export type PublishWordResult = {
  wordId: string;
  mergedIntoWordId: string | null;
};

/**
 * Flip status tayang kata (admin/root/reviewer). Bukan is_verified -
 * itu VerifyWordUseCase. Publish → published + verified (atau merge makna
 * ke lemma published yang sudah ada, 12-api §8); unpublish → draft.
 */
export class PublishWordUseCase {
  constructor(
    private readonly wordRepo: WordRepository,
    private readonly auditRepo: AuditLogRepository,
    private readonly syncContributions?: SyncLiveWordContributionsUseCase,
  ) {}

  async execute(cmd: PublishWordCommand): Promise<PublishWordResult> {
    const existing = await this.wordRepo.findById(cmd.wordId);
    if (!existing) {
      throw new NotFoundError('WORD_NOT_FOUND', 'Kata dengan id tersebut tidak ditemukan');
    }
    if (existing.status === 'taken_down') {
      throw new ConflictError(
        'WORD_ALREADY_MODERATED',
        'Entri ini ditarik. Pulihkan dulu sebelum mengubah status tayang.',
      );
    }

    if (!cmd.published) {
      const ok = await this.wordRepo.setPublished(cmd.wordId, {
        published: false,
        actorId: cmd.actorId,
      });
      if (!ok) {
        throw new NotFoundError('WORD_NOT_FOUND', 'Kata dengan id tersebut tidak ditemukan');
      }
      await this.auditRepo.record({
        userId: cmd.actorId,
        action: 'unpublish',
        entityType: 'word',
        entityId: cmd.wordId,
        newData: { status: 'draft' },
        requestId: cmd.requestId ?? null,
      });
      return { wordId: cmd.wordId, mergedIntoWordId: null };
    }

    const result = await this.wordRepo.publishOrMergeMeanings(cmd.wordId, cmd.actorId);
    if (!result) {
      throw new NotFoundError('WORD_NOT_FOUND', 'Kata dengan id tersebut tidak ditemukan');
    }

    await this.auditRepo.record({
      userId: cmd.actorId,
      action: result.mergedIntoWordId ? 'merge_publish' : 'publish',
      entityType: 'word',
      entityId: result.wordId,
      newData: {
        status: 'published',
        is_verified: true,
        ...(result.mergedIntoWordId
          ? { merged_into_word_id: result.mergedIntoWordId, source_word_id: cmd.wordId }
          : {}),
      },
      requestId: cmd.requestId ?? null,
    });

    if (result.mergedIntoWordId && result.mergedIntoWordId !== cmd.wordId) {
      await this.syncContributions?.closeMerged(result.wordId, cmd.wordId, cmd.actorId);
    } else {
      await this.syncContributions?.closeLive(result.wordId, cmd.actorId);
    }

    return result;
  }
}
