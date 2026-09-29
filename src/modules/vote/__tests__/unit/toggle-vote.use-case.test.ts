import { describe, it, expect, vi } from 'vitest';
import { ToggleVoteUseCase } from '../../application/use-cases/toggle-vote.use-case';
import type { VoteRepository } from '../../domain/repositories/vote.repository';

function makeDeps(exists = true) {
  const voteRepo = {
    targetExists: vi.fn().mockResolvedValue(exists),
    toggle: vi.fn().mockResolvedValue({ myVote: 1, upvotes: 1, downvotes: 0 }),
    countMany: vi.fn(),
    findUserVotes: vi.fn(),
    resolveWordOwnerForVoteTarget: vi.fn().mockResolvedValue(null),
  } as unknown as VoteRepository;
  return { voteRepo, useCase: new ToggleVoteUseCase(voteRepo) };
}

const USER = '01JDUSERKONTRIB0000000000A';
const WORD_ID = '01JDWORDMAKATN0000000000A';
const TARGET = { entityType: 'word' as const, entityId: WORD_ID };

describe('ToggleVoteUseCase', () => {
  it('target ada → toggle(userId, target, value) dipanggil, hasil diteruskan', async () => {
    const { useCase, voteRepo } = makeDeps();
    const result = await useCase.execute({ userId: USER, targetType: 'word', targetId: WORD_ID, value: 1 });

    expect(voteRepo.targetExists).toHaveBeenCalledWith(TARGET);
    expect(voteRepo.toggle).toHaveBeenCalledWith(USER, TARGET, 1, null);
    expect(result).toEqual({ myVote: 1, upvotes: 1, downvotes: 0 });
  });

  it('target tidak ada / sudah soft-deleted → 404 VOTE_TARGET_NOT_FOUND, toggle TIDAK dipanggil', async () => {
    const { useCase, voteRepo } = makeDeps(false);
    await expect(
      useCase.execute({ userId: USER, targetType: 'word', targetId: WORD_ID, value: -1 }),
    ).rejects.toMatchObject({ errorCode: 'VOTE_TARGET_NOT_FOUND', statusCode: 404 });
    expect(voteRepo.toggle).not.toHaveBeenCalled();
  });

  it('discussion + downvote → VALIDATION_ERROR, toggle TIDAK dipanggil', async () => {
    const { useCase, voteRepo } = makeDeps();
    await expect(
      useCase.execute({
        userId: USER,
        targetType: 'discussion',
        targetId: WORD_ID,
        value: -1,
      }),
    ).rejects.toMatchObject({ errorCode: 'VALIDATION_ERROR', statusCode: 400 });
    expect(voteRepo.targetExists).not.toHaveBeenCalled();
    expect(voteRepo.toggle).not.toHaveBeenCalled();
  });

  it('cast vote → notify pemilik kata (inbox + push)', async () => {
    const OWNER = '01JDOWNERWORD000000000000A';
    const voteRepo = {
      targetExists: vi.fn().mockResolvedValue(true),
      toggle: vi.fn().mockResolvedValue({ myVote: 1, upvotes: 1, downvotes: 0 }),
      resolveWordOwnerForVoteTarget: vi.fn().mockResolvedValue({
        wordId: WORD_ID,
        lemma: 'kete',
        ownerUserId: OWNER,
      }),
    } as unknown as VoteRepository;
    const inbox = { execute: vi.fn().mockResolvedValue(undefined) };
    const notifyUser = { execute: vi.fn().mockResolvedValue(undefined) };
    const pushCooldown = {
      maySend: vi.fn().mockResolvedValue(true),
      touchAfterSend: vi.fn().mockResolvedValue(undefined),
    };
    const userRepo = {
      findById: vi.fn().mockResolvedValue({
        id: USER,
        username: 'budi',
        displayName: 'Budi',
      }),
    };
    const useCase = new ToggleVoteUseCase(
      voteRepo,
      userRepo as never,
      inbox as never,
      notifyUser as never,
      pushCooldown as never,
    );

    await useCase.execute({ userId: USER, targetType: 'word', targetId: WORD_ID, value: 1 });
    // fire-and-forget notify - beri tick microtask
    await Promise.resolve();
    await Promise.resolve();

    expect(inbox.execute).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: OWNER,
        type: 'word_vote',
        targetKind: 'word',
        targetId: WORD_ID,
        actionKind: 'word',
        actionValue: WORD_ID,
        refreshOnConflict: true,
      }),
    );
    expect(notifyUser.execute).toHaveBeenCalled();
    expect(pushCooldown.touchAfterSend).toHaveBeenCalledWith(OWNER);
  });

  it('unvote (myVote null) → tidak notify', async () => {
    const voteRepo = {
      targetExists: vi.fn().mockResolvedValue(true),
      toggle: vi.fn().mockResolvedValue({ myVote: null, upvotes: 0, downvotes: 0 }),
      resolveWordOwnerForVoteTarget: vi.fn(),
    } as unknown as VoteRepository;
    const inbox = { execute: vi.fn() };
    const useCase = new ToggleVoteUseCase(voteRepo, undefined, inbox as never);
    await useCase.execute({ userId: USER, targetType: 'word', targetId: WORD_ID, value: 1 });
    await Promise.resolve();
    expect(voteRepo.resolveWordOwnerForVoteTarget).not.toHaveBeenCalled();
    expect(inbox.execute).not.toHaveBeenCalled();
  });
});
