import { describe, it, expect, vi } from 'vitest';
import { GetVoteDeckUseCase } from '../../application/use-cases/get-vote-deck.use-case';
import {
  encodeVoteDeckCursor,
  type VoteRepository,
} from '../../domain/repositories/vote.repository';

const USER = '01JDUSERKONTRIB0000000000A';

function makeDeps() {
  const voteRepo = {
    listDeckMeanings: vi.fn().mockResolvedValue({
      items: [],
      nextCursor: null,
      hasMore: false,
    }),
  } as unknown as VoteRepository;
  return { voteRepo, useCase: new GetVoteDeckUseCase(voteRepo) };
}

describe('GetVoteDeckUseCase', () => {
  it('tanpa cursor → listDeckMeanings(userId, { limit }) + meta kosong', async () => {
    const { useCase, voteRepo } = makeDeps();
    const result = await useCase.execute(USER, { limit: 10 });

    expect(voteRepo.listDeckMeanings).toHaveBeenCalledWith(USER, {
      limit: 10,
      cursor: undefined,
      randomize: undefined,
    });
    expect(result).toMatchObject({
      items: [],
      meta: { limit: 10, next_cursor: null, has_more: false },
    });
  });

  it('cursor valid → diteruskan ke repo', async () => {
    const { useCase, voteRepo } = makeDeps();
    const approvedAt = new Date('2026-01-15T00:00:00.000Z');
    const cursor = encodeVoteDeckCursor({
      totalVotes: 2,
      approvedAt,
      id: '01JDWORDMAKATN0000000000A',
    });

    await useCase.execute(USER, { limit: 5, cursor });

    expect(voteRepo.listDeckMeanings).toHaveBeenCalledWith(USER, {
      limit: 5,
      cursor: { totalVotes: 2, approvedAt, id: '01JDWORDMAKATN0000000000A' },
      randomize: undefined,
    });
  });

  it('randomize diteruskan apa adanya (false = kronologis)', async () => {
    const { useCase, voteRepo } = makeDeps();
    await useCase.execute(USER, { limit: 10, randomize: false });
    expect(voteRepo.listDeckMeanings).toHaveBeenCalledWith(USER, {
      limit: 10,
      cursor: undefined,
      randomize: false,
    });
  });

  it('cursor rusak → ValidationError field cursor', async () => {
    const { useCase, voteRepo } = makeDeps();
    await expect(useCase.execute(USER, { limit: 10, cursor: 'bukan-cursor' })).rejects.toMatchObject(
      { errorCode: 'VALIDATION_ERROR', statusCode: 400 },
    );
    expect(voteRepo.listDeckMeanings).not.toHaveBeenCalled();
  });
});
