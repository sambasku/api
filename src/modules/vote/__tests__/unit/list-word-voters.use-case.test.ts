import { describe, it, expect, vi } from 'vitest';
import { ListWordVotersUseCase } from '../../application/use-cases/list-word-voters.use-case';
import {
  encodeAdminCursor,
  type VoteRepository,
} from '../../domain/repositories/vote.repository';

function makeDeps() {
  const voteRepo = {
    listVotersByWordId: vi.fn().mockResolvedValue({
      items: [],
      meta: {
        limit: 20,
        nextCursor: null,
        hasMore: false,
        upvotes: 0,
        downvotes: 0,
      },
    }),
  } as unknown as VoteRepository;
  return { voteRepo, useCase: new ListWordVotersUseCase(voteRepo) };
}

describe('ListWordVotersUseCase', () => {
  it('cursor valid → diteruskan ke repo', async () => {
    const { useCase, voteRepo } = makeDeps();
    const createdAt = new Date('2026-09-25T16:27:10.000Z');
    const cursor = encodeAdminCursor({ createdAt, id: '01M3CP8SCJ29RNFWJ39DAYZEN2' });

    await useCase.execute({
      wordId: '01WORD00000000000000000001',
      filter: {},
      limit: 20,
      cursor,
    });

    expect(voteRepo.listVotersByWordId).toHaveBeenCalledWith(
      '01WORD00000000000000000001',
      {},
      20,
      { createdAt, id: '01M3CP8SCJ29RNFWJ39DAYZEN2' },
    );
  });

  it('cursor rusak → NotFoundError INVALID_CURSOR', async () => {
    const { useCase, voteRepo } = makeDeps();
    await expect(
      useCase.execute({
        wordId: '01WORD00000000000000000001',
        filter: {},
        limit: 20,
        cursor: 'bukan-cursor',
      }),
    ).rejects.toMatchObject({ errorCode: 'INVALID_CURSOR', statusCode: 404 });
    expect(voteRepo.listVotersByWordId).not.toHaveBeenCalled();
  });

  it('kata tidak ada → WORD_NOT_FOUND', async () => {
    const { useCase, voteRepo } = makeDeps();
    vi.mocked(voteRepo.listVotersByWordId).mockResolvedValueOnce(null);

    await expect(
      useCase.execute({
        wordId: '01WORD00000000000000000001',
        filter: {},
        limit: 20,
      }),
    ).rejects.toMatchObject({ errorCode: 'WORD_NOT_FOUND', statusCode: 404 });
  });
});
