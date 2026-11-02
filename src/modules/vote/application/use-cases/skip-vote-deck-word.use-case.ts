import { NotFoundError, ValidationError } from '@/shared/errors/app-error';
import type { UserSkipRepository } from '@/modules/user-skip/infrastructure/user-skip.repository';
import type { VoteRepository } from '../../domain/repositories/vote.repository';

export type SkipVoteDeckInput = {
  meaningId?: string;
  wordId?: string;
};

/**
 * Lewati kartu deck (per makna, 0101) tanpa menulis vote. Idempoten.
 * 52: terima meaning_id atau word_id (compat mobile ≤ v0.4.0).
 * 404 jika target tidak resolve ke makna published.
 */
export class SkipVoteDeckWordUseCase {
  constructor(
    private readonly voteRepo: VoteRepository,
    private readonly skips: UserSkipRepository,
  ) {}

  async skip(userId: string, input: SkipVoteDeckInput): Promise<{ meaningId: string }> {
    const meaningId = await this.resolveMeaningId(input);
    const exists = await this.voteRepo.targetExists({
      entityType: 'meaning',
      entityId: meaningId,
    });
    if (!exists) {
      throw new NotFoundError(
        'VOTE_TARGET_NOT_FOUND',
        'Target vote tidak ditemukan atau sudah dihapus',
      );
    }
    await this.skips.record(userId, 'meaning', meaningId);
    return { meaningId };
  }

  async unskip(userId: string, id: string): Promise<{ meaningId: string }> {
    // Path param boleh meaning atau word (52). Resolve best-effort; clear
    // idempoten meski makna sudah hilang - pakai id mentah bila resolve gagal
    // hanya jika id sudah meaning skip key.
    const resolved = await this.voteRepo.resolveLegacyWordVoteTarget(id);
    const meaningId = resolved?.meaningId ?? id;
    await this.skips.clear(userId, 'meaning', meaningId);
    return { meaningId };
  }

  private async resolveMeaningId(input: SkipVoteDeckInput): Promise<string> {
    if (input.meaningId) {
      return input.meaningId;
    }
    if (input.wordId) {
      const resolved = await this.voteRepo.resolveLegacyWordVoteTarget(input.wordId);
      if (!resolved) {
        throw new NotFoundError(
          'VOTE_TARGET_NOT_FOUND',
          'Target vote tidak ditemukan atau sudah dihapus',
        );
      }
      return resolved.meaningId;
    }
    throw new ValidationError([
      {
        field: 'meaning_id',
        message: 'Wajib mengisi meaning_id atau word_id',
      },
    ]);
  }
}
