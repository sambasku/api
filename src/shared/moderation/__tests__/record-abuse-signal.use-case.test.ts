import { describe, expect, it, vi, beforeEach } from 'vitest';
import { RecordAbuseSignalUseCase } from '@/shared/moderation/record-abuse-signal.use-case';
import type { UgcAbuseEventRepository } from '@/shared/moderation/ugc-abuse-event.repository';

describe('RecordAbuseSignalUseCase policy', () => {
  const abuseRepo: UgcAbuseEventRepository = {
    record: vi.fn().mockImplementation(async (input) => ({
      id: '01EVENT',
      userId: input.userId,
      signal: input.signal,
      weight: input.weight ?? 1,
      entityType: null,
      entityId: null,
      meta: null,
      createdAt: new Date(),
    })),
    sumWeightSince: vi.fn(),
    countSignalSince: vi.fn().mockResolvedValue(0),
    listByUser: vi.fn(),
    findRecentBodyHashes: vi.fn(),
  };

  const userRepo = {
    getContributeGate: vi.fn(),
    setContributeMutedUntil: vi.fn().mockResolvedValue(true),
    setCanContribute: vi.fn().mockResolvedValue(true),
    setIsActive: vi.fn().mockResolvedValue(true),
    findById: vi.fn().mockResolvedValue({
      id: '01USER',
      role: 'contributor',
    }),
  };

  const refreshTokenRepo = {
    revokeAllForUser: vi.fn().mockResolvedValue(undefined),
  };

  const auditRepo = {
    record: vi.fn().mockResolvedValue(undefined),
  };

  const inbox = {
    execute: vi.fn().mockResolvedValue(undefined),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    userRepo.getContributeGate.mockResolvedValue({
      isActive: true,
      canContribute: true,
      contributeMutedUntil: null,
    });
  });

  it('mute 1 jam bila score 24 jam >= 3', async () => {
    (abuseRepo.sumWeightSince as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce(3) // 24h
      .mockResolvedValueOnce(3) // 7d
      .mockResolvedValueOnce(3); // 30d

    const uc = new RecordAbuseSignalUseCase(
      abuseRepo,
      userRepo as never,
      refreshTokenRepo as never,
      auditRepo as never,
      inbox as never,
    );

    await uc.execute({ userId: '01USER', signal: 'input_rejected' });

    expect(userRepo.setContributeMutedUntil).toHaveBeenCalled();
    expect(auditRepo.record).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'auto_mute_contribute' }),
    );
  });

  it('pause can_contribute bila score 30 hari >= 10', async () => {
    (abuseRepo.sumWeightSince as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce(10)
      .mockResolvedValueOnce(10)
      .mockResolvedValueOnce(10);

    const uc = new RecordAbuseSignalUseCase(
      abuseRepo,
      userRepo as never,
      refreshTokenRepo as never,
      auditRepo as never,
      inbox as never,
    );

    await uc.execute({ userId: '01USER', signal: 'comment_takedown' });

    expect(userRepo.setCanContribute).toHaveBeenCalledWith('01USER', false);
    expect(inbox.execute).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'contribution_paused' }),
    );
  });

  it('deactivate bila score 30 hari >= 20', async () => {
    (abuseRepo.sumWeightSince as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce(20)
      .mockResolvedValueOnce(20)
      .mockResolvedValueOnce(20);

    const uc = new RecordAbuseSignalUseCase(
      abuseRepo,
      userRepo as never,
      refreshTokenRepo as never,
      auditRepo as never,
      inbox as never,
    );

    await uc.execute({ userId: '01USER', signal: 'rate_lockout' });

    expect(userRepo.setIsActive).toHaveBeenCalledWith('01USER', false);
    expect(refreshTokenRepo.revokeAllForUser).toHaveBeenCalledWith('01USER');
  });
});
