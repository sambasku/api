import { NotFoundError } from '@/shared/errors/app-error';
import type { UserSkipRepository } from '@/modules/user-skip/infrastructure/user-skip.repository';
import type { VoteRepository } from '../../domain/repositories/vote.repository';

/**
 * Lewati kartu deck tanpa menulis vote. Idempoten.
 * 404 jika kata tidak ada / sudah dihapus.
 */
export class SkipVoteDeckWordUseCase {
  constructor(
    private readonly voteRepo: VoteRepository,
    private readonly skips: UserSkipRepository,
  ) {}

  async skip(userId: string, wordId: string): Promise<void> {
    const exists = await this.voteRepo.targetExists({ entityType: 'word', entityId: wordId });
    if (!exists) {
      throw new NotFoundError(
        'VOTE_TARGET_NOT_FOUND',
        'Target vote tidak ditemukan atau sudah dihapus',
      );
    }
    await this.skips.record(userId, 'word', wordId);
  }

  async unskip(userId: string, wordId: string): Promise<void> {
    await this.skips.clear(userId, 'word', wordId);
  }
}
