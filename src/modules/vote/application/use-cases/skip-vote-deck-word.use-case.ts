import { NotFoundError } from '@/shared/errors/app-error';
import type { UserSkipRepository } from '@/modules/user-skip/infrastructure/user-skip.repository';
import type { VoteRepository } from '../../domain/repositories/vote.repository';

/**
 * Lewati kartu deck (per makna, 0101) tanpa menulis vote. Idempoten.
 * 404 jika makna tidak ada / sudah dihapus.
 */
export class SkipVoteDeckWordUseCase {
  constructor(
    private readonly voteRepo: VoteRepository,
    private readonly skips: UserSkipRepository,
  ) {}

  async skip(userId: string, meaningId: string): Promise<void> {
    const exists = await this.voteRepo.targetExists({ entityType: 'meaning', entityId: meaningId });
    if (!exists) {
      throw new NotFoundError(
        'VOTE_TARGET_NOT_FOUND',
        'Target vote tidak ditemukan atau sudah dihapus',
      );
    }
    await this.skips.record(userId, 'meaning', meaningId);
  }

  async unskip(userId: string, meaningId: string): Promise<void> {
    await this.skips.clear(userId, 'meaning', meaningId);
  }
}
