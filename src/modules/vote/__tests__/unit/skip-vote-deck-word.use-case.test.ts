import { describe, expect, it, vi } from 'vitest';
import { SkipVoteDeckWordUseCase } from '../../application/use-cases/skip-vote-deck-word.use-case';
import type { VoteRepository } from '../../domain/repositories/vote.repository';
import type { UserSkipRepository } from '@/modules/user-skip/infrastructure/user-skip.repository';

const USER = '01JDUSERKONTRIB0000000000A';
const MEANING = '01JDMEANINGMAKATN0000000A';
const WORD = '01JDWORDMAKATN0000000000A';

function makeDeps(exists = true) {
  const voteRepo = {
    targetExists: vi.fn().mockResolvedValue(exists),
    resolveLegacyWordVoteTarget: vi.fn().mockResolvedValue({
      meaningId: MEANING,
      wordId: WORD,
    }),
  } as unknown as VoteRepository;
  const skips = {
    record: vi.fn().mockResolvedValue(undefined),
    clear: vi.fn().mockResolvedValue(undefined),
  } as unknown as UserSkipRepository;
  return { voteRepo, skips, useCase: new SkipVoteDeckWordUseCase(voteRepo, skips) };
}

describe('SkipVoteDeckWordUseCase (0101: skip per makna + 52 compat)', () => {
  it('meaning_id → record skip meaning', async () => {
    const { useCase, skips } = makeDeps();
    const out = await useCase.skip(USER, { meaningId: MEANING });
    expect(skips.record).toHaveBeenCalledWith(USER, 'meaning', MEANING);
    expect(out).toEqual({ meaningId: MEANING });
  });

  it('word_id → resolve lalu record skip meaning (52)', async () => {
    const { useCase, skips, voteRepo } = makeDeps();
    const out = await useCase.skip(USER, { wordId: WORD });
    expect(voteRepo.resolveLegacyWordVoteTarget).toHaveBeenCalledWith(WORD);
    expect(skips.record).toHaveBeenCalledWith(USER, 'meaning', MEANING);
    expect(out).toEqual({ meaningId: MEANING });
  });

  it('makna tidak ada → 404, tidak menulis skip', async () => {
    const { useCase, skips } = makeDeps(false);
    await expect(useCase.skip(USER, { meaningId: MEANING })).rejects.toMatchObject({
      errorCode: 'VOTE_TARGET_NOT_FOUND',
      statusCode: 404,
    });
    expect(skips.record).not.toHaveBeenCalled();
  });

  it('word_id tanpa makna → 404', async () => {
    const { useCase, skips, voteRepo } = makeDeps();
    (voteRepo.resolveLegacyWordVoteTarget as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    await expect(useCase.skip(USER, { wordId: WORD })).rejects.toMatchObject({
      errorCode: 'VOTE_TARGET_NOT_FOUND',
      statusCode: 404,
    });
    expect(skips.record).not.toHaveBeenCalled();
  });

  it('unskip resolve word id → clear meaning', async () => {
    const { useCase, skips, voteRepo } = makeDeps(false);
    const out = await useCase.unskip(USER, WORD);
    expect(voteRepo.resolveLegacyWordVoteTarget).toHaveBeenCalledWith(WORD);
    expect(skips.clear).toHaveBeenCalledWith(USER, 'meaning', MEANING);
    expect(out).toEqual({ meaningId: MEANING });
  });
});
