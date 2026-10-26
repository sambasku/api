import { describe, expect, it, vi } from 'vitest';
import { SkipVoteDeckWordUseCase } from '../../application/use-cases/skip-vote-deck-word.use-case';
import type { VoteRepository } from '../../domain/repositories/vote.repository';
import type { UserSkipRepository } from '@/modules/user-skip/infrastructure/user-skip.repository';

const USER = '01JDUSERKONTRIB0000000000A';
const MEANING = '01JDMEANINGMAKATN0000000A';

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

describe('SkipVoteDeckWordUseCase (0101: skip per makna)', () => {
  it('makna ada → record skip meaning', async () => {
    const { useCase, skips } = makeDeps();
    await useCase.skip(USER, MEANING);
    expect(skips.record).toHaveBeenCalledWith(USER, 'meaning', MEANING);
  });

  it('makna tidak ada → 404, tidak menulis skip', async () => {
    const { useCase, skips } = makeDeps(false);
    await expect(useCase.skip(USER, MEANING)).rejects.toMatchObject({
      errorCode: 'VOTE_TARGET_NOT_FOUND',
      statusCode: 404,
    });
    expect(skips.record).not.toHaveBeenCalled();
  });

  it('unskip menghapus catatan tanpa cek makna', async () => {
    const { useCase, skips, voteRepo } = makeDeps(false);
    await useCase.unskip(USER, MEANING);
    expect(voteRepo.targetExists).not.toHaveBeenCalled();
    expect(skips.clear).toHaveBeenCalledWith(USER, 'meaning', MEANING);
  });
});
