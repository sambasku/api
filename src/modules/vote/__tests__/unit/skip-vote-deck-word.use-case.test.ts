import { describe, expect, it, vi } from 'vitest';
import { SkipVoteDeckWordUseCase } from '../../application/use-cases/skip-vote-deck-word.use-case';
import type { VoteRepository } from '../../domain/repositories/vote.repository';
import type { UserSkipRepository } from '@/modules/user-skip/infrastructure/user-skip.repository';

const USER = '01JDUSERKONTRIB0000000000A';
const WORD = '01JDWORDMAKATN0000000000A';

function makeDeps(exists = true) {
  const voteRepo = {
    targetExists: vi.fn().mockResolvedValue(exists),
  } as unknown as VoteRepository;
  const skips = {
    record: vi.fn().mockResolvedValue(undefined),
    clear: vi.fn().mockResolvedValue(undefined),
  } as unknown as UserSkipRepository;
  return { voteRepo, skips, useCase: new SkipVoteDeckWordUseCase(voteRepo, skips) };
}

describe('SkipVoteDeckWordUseCase', () => {
  it('kata ada → record skip word', async () => {
    const { useCase, skips } = makeDeps();
    await useCase.skip(USER, WORD);
    expect(skips.record).toHaveBeenCalledWith(USER, 'word', WORD);
  });

  it('kata tidak ada → 404, tidak menulis skip', async () => {
    const { useCase, skips } = makeDeps(false);
    await expect(useCase.skip(USER, WORD)).rejects.toMatchObject({
      errorCode: 'VOTE_TARGET_NOT_FOUND',
      statusCode: 404,
    });
    expect(skips.record).not.toHaveBeenCalled();
  });

  it('unskip menghapus catatan tanpa cek kata', async () => {
    const { useCase, skips, voteRepo } = makeDeps(false);
    await useCase.unskip(USER, WORD);
    expect(voteRepo.targetExists).not.toHaveBeenCalled();
    expect(skips.clear).toHaveBeenCalledWith(USER, 'word', WORD);
  });
});
