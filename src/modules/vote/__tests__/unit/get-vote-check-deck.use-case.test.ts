import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it, expect, vi } from 'vitest';
import { GetVoteCheckDeckUseCase } from '../../application/use-cases/get-vote-check-deck.use-case';
import {
  encodeVoteDeckCursor,
  type VoteRepository,
} from '../../domain/repositories/vote.repository';
import {
  voteCheckDeckQuerySchema,
  voteDeckQuerySchema,
} from '../../presentation/v1/validators/vote.validator';

const DECK_REPO_SRC = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), '../../infrastructure/vote.repository.impl.ts'),
  'utf8',
);

const USER = '01JDUSERKONTRIB0000000000A';

function makeDeps() {
  const voteRepo = {
    listCheckDeckMeanings: vi.fn().mockResolvedValue({
      items: [],
      nextCursor: null,
      hasMore: false,
    }),
  } as unknown as VoteRepository;
  return { voteRepo, useCase: new GetVoteCheckDeckUseCase(voteRepo) };
}

describe('GetVoteCheckDeckUseCase', () => {
  it('tanpa cursor → listCheckDeckMeanings(userId, { limit }) + meta kosong', async () => {
    const { useCase, voteRepo } = makeDeps();
    const result = await useCase.execute(USER, { limit: 10 });

    expect(voteRepo.listCheckDeckMeanings).toHaveBeenCalledWith(USER, {
      limit: 10,
      cursor: undefined,
      randomize: undefined,
      q: undefined,
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
      id: '01JDMEANINGCHECK00000000A',
    });

    await useCase.execute(USER, { limit: 5, cursor });

    expect(voteRepo.listCheckDeckMeanings).toHaveBeenCalledWith(USER, {
      limit: 5,
      cursor: { totalVotes: 2, approvedAt, id: '01JDMEANINGCHECK00000000A' },
      randomize: undefined,
      q: undefined,
    });
  });

  it('randomize diteruskan apa adanya (false = kronologis)', async () => {
    const { useCase, voteRepo } = makeDeps();
    await useCase.execute(USER, { limit: 10, randomize: false });
    expect(voteRepo.listCheckDeckMeanings).toHaveBeenCalledWith(USER, {
      limit: 10,
      cursor: undefined,
      randomize: false,
      q: undefined,
    });
  });

  it('cursor rusak → ValidationError field cursor', async () => {
    const { useCase, voteRepo } = makeDeps();
    await expect(useCase.execute(USER, { limit: 10, cursor: 'bukan-cursor' })).rejects.toMatchObject(
      { errorCode: 'VALIDATION_ERROR', statusCode: 400 },
    );
    expect(voteRepo.listCheckDeckMeanings).not.toHaveBeenCalled();
  });

  it('meneruskan q ke listCheckDeckMeanings', async () => {
    const { useCase, voteRepo } = makeDeps();
    await useCase.execute(USER, { limit: 10, q: 'ling', randomize: false });
    expect(voteRepo.listCheckDeckMeanings).toHaveBeenCalledWith(USER, {
      limit: 10,
      cursor: undefined,
      randomize: false,
      q: 'ling',
    });
  });

  it('regresi: check-deck filter makna belum verified; deck verified tetap ada', () => {
    expect(DECK_REPO_SRC).toMatch(/listCheckDeckMeanings/);
    expect(DECK_REPO_SRC).toMatch(/orderTotalVotesDesc:\s*true/);
    expect(DECK_REPO_SRC).toMatch(/meaningVerified:\s*false/);
    expect(DECK_REPO_SRC).toMatch(/meaningVerified:\s*true/);
    expect(DECK_REPO_SRC).toMatch(/eq\(meanings\.isVerified,\s*trust\.meaningVerified\)/);
    expect(DECK_REPO_SRC).toMatch(/opts\.q/);
    expect(DECK_REPO_SRC).toMatch(/ilikeCompat\(words\.lemma/);
  });
});

describe('voteCheckDeckQuerySchema (#379)', () => {
  it('default randomize=false → antrean Periksa Kata urut voting terbanyak', () => {
    expect(voteCheckDeckQuerySchema.parse({}).randomize).toBe(false);
  });

  it('randomize=true eksplisit tetap diterima', () => {
    expect(voteCheckDeckQuerySchema.parse({ randomize: 'true' }).randomize).toBe(true);
    expect(voteCheckDeckQuerySchema.parse({ randomize: '1' }).randomize).toBe(true);
  });

  it('deck verified (/votes/deck) tetap default acak', () => {
    expect(voteDeckQuerySchema.parse({}).randomize).toBe(true);
  });

  it('regresi: check-deck repo mengurutkan total DESC', () => {
    expect(DECK_REPO_SRC).toMatch(/orderTotalVotesDesc:\s*true/);
  });
});
