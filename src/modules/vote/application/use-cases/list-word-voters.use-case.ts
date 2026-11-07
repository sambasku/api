import { NotFoundError } from '@/shared/errors/app-error';
import type {
  VoteRepository,
  WordVotersListFilter,
  WordVotersListResult,
} from '../../domain/repositories/vote.repository';
import { decodeAdminCursor } from '../../domain/repositories/vote.repository';

export interface ListWordVotersCommand {
  wordId: string;
  filter: WordVotersListFilter;
  limit: number;
  cursor?: string | null;
}

/**
 * Daftar voter makna milik satu kata (admin). Decode cursor + 404 kata hilang.
 */
export class ListWordVotersUseCase {
  constructor(private readonly voteRepo: VoteRepository) {}

  async execute(cmd: ListWordVotersCommand): Promise<WordVotersListResult> {
    let cursor = null;
    if (cmd.cursor) {
      try {
        cursor = decodeAdminCursor(cmd.cursor);
      } catch {
        throw new NotFoundError('INVALID_CURSOR', 'Format paginasi cursor tidak valid');
      }
    }

    const result = await this.voteRepo.listVotersByWordId(
      cmd.wordId,
      cmd.filter,
      cmd.limit,
      cursor,
    );
    if (!result) {
      throw new NotFoundError('WORD_NOT_FOUND', 'Kata dengan id tersebut tidak ditemukan');
    }
    return result;
  }
}
