import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ApplyMeaningVoteTrustUseCase } from '../../application/use-cases/apply-meaning-vote-trust.use-case';
import {
  VOTING_WARGA_NET_THRESHOLD,
  VOTING_WARGA_USER_ID,
} from '@/shared/constants/voting-warga';
import {
  AUTO_VERIFY_BY_VOTE_ENABLED_KEY,
  VOTING_WARGA_NET_THRESHOLD_KEY,
  VOTING_WARGA_UNIQUE_VOTERS_THRESHOLD_KEY,
} from '@/modules/legal/domain/entities/app-setting.entity';
import type { WordRepository } from '@/modules/word/domain/repositories/word.repository';
import type { AppSettingsRepository } from '@/modules/legal/domain/repositories/app-settings.repository';

const MEANING_ID = '01JDMEANINGMAKATN0000000A';
const WORD_ID = '01JDWORDMAKATN0000000000A';
const CREATOR = '01JDUSERKONTRIB0000000000A';
const ACTOR = '01JDUSERVOTER00000000000A';
const BATCH_ID = '01JDBATCHDISPUTE000000000A';

vi.mock('../../application/reset-meaning-votes-on-content-change', () => ({
  resetMeaningVotesOnContentChange: vi.fn().mockResolvedValue({
    archived: 10,
    meaningsReset: 1,
    batchId: '01JDBATCHDISPUTE000000000A',
  }),
}));

import { resetMeaningVotesOnContentChange } from '../../application/reset-meaning-votes-on-content-change';

function makeState(
  overrides: Partial<{
    status: string;
    isVerified: boolean;
    needsReview: boolean;
    createdBy: string | null;
  }> = {},
) {
  return {
    meaningId: MEANING_ID,
    wordId: WORD_ID,
    lemma: 'makatn',
    status: 'published',
    isVerified: false,
    needsReview: false,
    createdBy: CREATOR,
    ...overrides,
  };
}

function makeDeps(
  opts: {
    enabled?: boolean;
    state?: ReturnType<typeof makeState> | null;
    netThreshold?: string | null;
    uniqueThreshold?: string | null;
  } = {},
) {
  const wordRepo = {
    findMeaningTrustState: vi
      .fn()
      .mockResolvedValue(opts.state === undefined ? makeState() : opts.state),
    setMeaningVerified: vi.fn().mockResolvedValue({ wordId: WORD_ID }),
    setMeaningNeedsReview: vi
      .fn()
      .mockResolvedValue({ wordId: WORD_ID, changed: true }),
    rejectMeaningByCommunityVote: vi
      .fn()
      .mockResolvedValue({ wordId: WORD_ID, wordRejected: true }),
  } as unknown as WordRepository;

  const settingsRepo = {
    getValue: vi.fn().mockImplementation(async (key: string) => {
      if (key === AUTO_VERIFY_BY_VOTE_ENABLED_KEY) {
        return opts.enabled === false ? 'false' : 'true';
      }
      if (key === VOTING_WARGA_NET_THRESHOLD_KEY) {
        return opts.netThreshold === undefined ? '5' : opts.netThreshold;
      }
      if (key === VOTING_WARGA_UNIQUE_VOTERS_THRESHOLD_KEY) {
        return opts.uniqueThreshold === undefined ? '5' : opts.uniqueThreshold;
      }
      return null;
    }),
  } as unknown as AppSettingsRepository;

  const activityEvents = { safe: vi.fn().mockResolvedValue(undefined) };
  const inbox = { execute: vi.fn().mockResolvedValue(undefined) };
  const notifyUser = { execute: vi.fn().mockResolvedValue(undefined) };
  const auditRepo = { record: vi.fn().mockResolvedValue(undefined) };
  const useCase = new ApplyMeaningVoteTrustUseCase(
    wordRepo,
    settingsRepo,
    auditRepo as never,
    activityEvents as never,
    inbox as never,
    notifyUser as never,
  );
  return {
    useCase,
    wordRepo,
    settingsRepo,
    activityEvents,
    inbox,
    notifyUser,
    auditRepo,
  };
}

describe('ApplyMeaningVoteTrustUseCase', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(resetMeaningVotesOnContentChange).mockResolvedValue({
      archived: 10,
      meaningsReset: 1,
      batchId: BATCH_ID,
    });
  });

  it('kill switch off → none', async () => {
    const { useCase, wordRepo } = makeDeps({ enabled: false });
    const result = await useCase.execute({
      meaningId: MEANING_ID,
      upvotes: VOTING_WARGA_NET_THRESHOLD,
      downvotes: 0,
      actorId: ACTOR,
    });
    expect(result).toEqual({ action: 'none' });
    expect(wordRepo.setMeaningVerified).not.toHaveBeenCalled();
  });

  it('net + unique mencapai ambang → auto_verified Voting Warga', async () => {
    const { useCase, wordRepo, activityEvents, inbox } = makeDeps({
      enabled: true,
    });
    const result = await useCase.execute({
      meaningId: MEANING_ID,
      upvotes: 5,
      downvotes: 0,
      actorId: ACTOR,
    });
    expect(result).toEqual({ action: 'auto_verified', wordId: WORD_ID });
    expect(wordRepo.setMeaningVerified).toHaveBeenCalledWith(
      MEANING_ID,
      expect.objectContaining({
        isVerified: true,
        verifiedBy: VOTING_WARGA_USER_ID,
      }),
    );
    expect(activityEvents.safe).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: 'word_verified',
        actorId: VOTING_WARGA_USER_ID,
      }),
    );
    expect(inbox.execute).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: CREATOR,
        type: 'meaning_auto_verified',
      }),
    );
  });

  it('net di bawah ambang → none', async () => {
    const { useCase, wordRepo } = makeDeps({ enabled: true });
    const result = await useCase.execute({
      meaningId: MEANING_ID,
      upvotes: 4,
      downvotes: 0,
      actorId: ACTOR,
    });
    expect(result).toEqual({ action: 'none' });
    expect(wordRepo.setMeaningVerified).not.toHaveBeenCalled();
  });

  it('sudah verified + net 0 → none (aman)', async () => {
    const { useCase, wordRepo } = makeDeps({
      enabled: true,
      state: makeState({ isVerified: true }),
    });
    const result = await useCase.execute({
      meaningId: MEANING_ID,
      upvotes: 5,
      downvotes: 5,
      actorId: ACTOR,
    });
    expect(result).toEqual({ action: 'none' });
    expect(resetMeaningVotesOnContentChange).not.toHaveBeenCalled();
    expect(wordRepo.setMeaningNeedsReview).not.toHaveBeenCalled();
  });

  it('sudah verified + net <= -N + unique cukup → unverify + reset vote', async () => {
    const { useCase, wordRepo, inbox, auditRepo } = makeDeps({
      enabled: true,
      state: makeState({ isVerified: true, needsReview: false }),
    });
    const result = await useCase.execute({
      meaningId: MEANING_ID,
      upvotes: 0,
      downvotes: 5,
      actorId: ACTOR,
    });
    expect(result).toEqual({
      action: 'unverify_reset',
      wordId: WORD_ID,
      batchId: BATCH_ID,
      archived: 10,
    });
    expect(resetMeaningVotesOnContentChange).toHaveBeenCalledWith(
      expect.objectContaining({
        meaningIds: [MEANING_ID],
        wordId: WORD_ID,
        reason: 'voting_warga_dispute',
        actorId: VOTING_WARGA_USER_ID,
        skipEditKillSwitch: true,
      }),
    );
    expect(wordRepo.setMeaningNeedsReview).not.toHaveBeenCalled();
    expect(auditRepo.record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'unverify_by_vote_quorum',
        entityType: 'meaning',
      }),
    );
    expect(inbox.execute).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'meaning_needs_review' }),
    );
  });

  it('sudah verified + unique < N → none meski net jelek', async () => {
    const { useCase } = makeDeps({
      enabled: true,
      state: makeState({ isVerified: true }),
    });
    const result = await useCase.execute({
      meaningId: MEANING_ID,
      upvotes: 0,
      downvotes: 4,
      actorId: ACTOR,
    });
    expect(result).toEqual({ action: 'none' });
    expect(resetMeaningVotesOnContentChange).not.toHaveBeenCalled();
  });

  it('net <= -5 + unique cukup → auto_rejected Voting Warga', async () => {
    const { useCase, wordRepo, inbox, auditRepo } = makeDeps({ enabled: true });
    const result = await useCase.execute({
      meaningId: MEANING_ID,
      upvotes: 0,
      downvotes: 5,
      actorId: ACTOR,
    });
    expect(result).toEqual({
      action: 'auto_rejected',
      wordId: WORD_ID,
      wordRejected: true,
    });
    expect(wordRepo.rejectMeaningByCommunityVote).toHaveBeenCalledWith(
      MEANING_ID,
      VOTING_WARGA_USER_ID,
    );
    expect(wordRepo.setMeaningVerified).not.toHaveBeenCalled();
    expect(inbox.execute).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'meaning_auto_rejected' }),
    );
    expect(auditRepo.record).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'reject', entityType: 'meaning' }),
    );
  });

  it('kill switch off → tidak auto-tolak meski net -5', async () => {
    const { useCase, wordRepo } = makeDeps({ enabled: false });
    const result = await useCase.execute({
      meaningId: MEANING_ID,
      upvotes: 0,
      downvotes: 5,
      actorId: ACTOR,
    });
    expect(result).toEqual({ action: 'none' });
    expect(wordRepo.rejectMeaningByCommunityVote).not.toHaveBeenCalled();
  });

  it('makna sudah rejected (status) → none', async () => {
    const { useCase, wordRepo } = makeDeps({
      enabled: true,
      state: makeState({ status: 'rejected' }),
    });
    const result = await useCase.execute({
      meaningId: MEANING_ID,
      upvotes: 0,
      downvotes: 5,
      actorId: ACTOR,
    });
    expect(result).toEqual({ action: 'none' });
    expect(wordRepo.rejectMeaningByCommunityVote).not.toHaveBeenCalled();
  });
});
