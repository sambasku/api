import { ValidationError } from '@/shared/errors/app-error';
import {
  decodeVoteDeckCursor,
  type VoteDeckListResult,
  type VoteRepository,
} from '../../domain/repositories/vote.repository';

export interface GetVoteDeckQuery {
  limit: number;
  cursor?: string;
  /** false = kronologis; default true (acak isi halaman per user). */
  randomize?: boolean;
}

/**
 * Antrean MAKNA published yang pemohon belum vote (34-api-vote-deck.md,
 * 0101: deck per makna - 1 kartu = 1 makna).
 */
export class GetVoteDeckUseCase {
  constructor(private readonly voteRepo: VoteRepository) {}

  async execute(userId: string, query: GetVoteDeckQuery): Promise<VoteDeckListResult & {
    meta: { limit: number; next_cursor: string | null; has_more: boolean };
  }> {
    let cursor;
    if (query.cursor) {
      try {
        cursor = decodeVoteDeckCursor(query.cursor);
      } catch {
        throw new ValidationError([{ field: 'cursor', message: 'Format cursor tidak valid' }]);
      }
    }

    const page = await this.voteRepo.listDeckMeanings(userId, {
      limit: query.limit,
      cursor,
      randomize: query.randomize,
    });

    return {
      ...page,
      meta: {
        limit: query.limit,
        next_cursor: page.nextCursor,
        has_more: page.hasMore,
      },
    };
  }
}
