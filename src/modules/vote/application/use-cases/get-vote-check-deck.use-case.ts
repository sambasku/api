import { ValidationError } from '@/shared/errors/app-error';
import {
  decodeVoteDeckCursor,
  type VoteDeckListResult,
  type VoteRepository,
} from '../../domain/repositories/vote.repository';

export interface GetVoteCheckDeckQuery {
  limit: number;
  cursor?: string;
  /** false = kronologis; default true (acak isi halaman per user). */
  randomize?: boolean;
  q?: string;
}

/**
 * Antrean Periksa Kata: makna published belum verified yang pemohon
 * belum vote (docs/produk/periksa-kata.md).
 */
export class GetVoteCheckDeckUseCase {
  constructor(private readonly voteRepo: VoteRepository) {}

  async execute(
    userId: string,
    query: GetVoteCheckDeckQuery,
  ): Promise<
    VoteDeckListResult & {
      meta: { limit: number; next_cursor: string | null; has_more: boolean };
    }
  > {
    let cursor;
    if (query.cursor) {
      try {
        cursor = decodeVoteDeckCursor(query.cursor);
      } catch {
        throw new ValidationError([{ field: 'cursor', message: 'Format cursor tidak valid' }]);
      }
    }

    const page = await this.voteRepo.listCheckDeckMeanings(userId, {
      limit: query.limit,
      cursor,
      randomize: query.randomize,
      q: query.q,
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
