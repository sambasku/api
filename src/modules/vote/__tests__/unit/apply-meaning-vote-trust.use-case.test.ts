import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ApplyMeaningVoteTrustUseCase } from '../../application/use-cases/apply-meaning-vote-trust.use-case';
import {
  VOTING_WARGA_NEEDS_REVIEW_NET,
  VOTING_WARGA_NET_THRESHOLD,
  VOTING_WARGA_USER_ID,
} from '@/shared/constants/voting-warga';
import type { WordRepository } from '@/modules/word/domain/repositories/word.repository';
import type { AppSettingsRepository } from '@/modules/legal/domain/repositories/app-settings.repository';

const MEANING_ID = '01JDMEANINGMAKATN0000000A';
const WORD_ID = '01JDWORDMAKATN0000000000A';
const CREATOR = '01JDUSERKONTRIB0000000000A';
const ACTOR = '01JDUSERVOTER00000000000A';

function makeState(overrides: Partial<{
  isVerified: boolean;
  needsReview: boolean;
  createdBy: string | null;
}> = {}) {
  return {
    meaningId: MEANING_ID,
    wordId: WORD_ID,
    lemma: 'makatn',
    isVerified: false,
    needsReview: false,
    createdBy: CREATOR,
    ...overrides,
  };
}

function makeDeps(opts: {
  enabled?: boolean;
  state?: ReturnType<typeof makeState> | null;
} = {}) {
  const wordRepo = {
    findMeaningTrustState: vi.fn().mockResolvedValue(
      opts.state === undefined ? makeState() : opts.state,
    ),
    setMeaningVerified: vi.fn().mockResolvedValue({ wordId: WORD_ID }),
    setMeaningNeedsReview: vi.fn().mockResolvedValue({ wordId: WORD_ID, changed: true }),
  } as unknown as WordRepository;
  const settingsRepo = {
    getValue: vi.fn().mockResolvedValue(opts.enabled === false ? 'false' : 'true'),
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
  return { useCase, wordRepo, settingsRepo, activityEvents, inbox, notifyUser, auditRepo };
}

describe('ApplyMeaningVoteTrustUseCase', () => {
  beforeEach(() => {
    vi.clearAllMocks();
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
    const { useCase, wordRepo, activityEvents, inbox } = makeDeps({ enabled: true });
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
    expect(wordRepo.setMeaningNeedsReview).not.toHaveBeenCalled();
  });

  it('sudah verified + net <= -5 → needs_review, centang tidak dicabut', async () => {
    const { useCase, wordRepo, inbox } = makeDeps({
      enabled: true,
      state: makeState({ isVerified: true, needsReview: false }),
    });
    const result = await useCase.execute({
      meaningId: MEANING_ID,
      upvotes: 5,
      downvotes: 5 + Math.abs(VOTING_WARGA_NEEDS_REVIEW_NET),
      actorId: ACTOR,
    });
    expect(result).toEqual({ action: 'needs_review', wordId: WORD_ID });
    expect(wordRepo.setMeaningVerified).not.toHaveBeenCalled();
    expect(wordRepo.setMeaningNeedsReview).toHaveBeenCalledWith(
      MEANING_ID,
      true,
      VOTING_WARGA_USER_ID,
    );
    expect(inbox.execute).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'meaning_needs_review' }),
    );
  });

  it('sudah needs_review → tidak spam flag lagi', async () => {
    const { useCase, wordRepo } = makeDeps({
      enabled: true,
      state: makeState({ isVerified: true, needsReview: true }),
    });
    const result = await useCase.execute({
      meaningId: MEANING_ID,
      upvotes: 0,
      downvotes: 10,
      actorId: ACTOR,
    });
    expect(result).toEqual({ action: 'none' });
    expect(wordRepo.setMeaningNeedsReview).not.toHaveBeenCalled();
  });
});
