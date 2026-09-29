import { beforeEach, describe, expect, it, vi } from 'vitest';
import { RecordAnonAbuseSignalUseCase } from '@/shared/moderation/record-anon-abuse-signal.use-case';
import { assertAnonWriteAllowed } from '@/shared/moderation/record-anon-abuse-signal.use-case';
import type { UgcAnonAbuseRepository } from '@/shared/moderation/ugc-anon-abuse.repository';
import { ForbiddenError } from '@/shared/errors/app-error';

describe('RecordAnonAbuseSignalUseCase', () => {
  const mutes = new Map<string, Date>();
  const weights = new Map<string, number>();

  const repo: UgcAnonAbuseRepository = {
    record: vi.fn().mockImplementation(async (input) => {
      if (input.signal === 'policy_mute') return;
      const k = `${input.subject.kind}:${input.subject.key}`;
      weights.set(k, (weights.get(k) ?? 0) + (input.weight ?? 1));
    }),
    sumWeightSince: vi.fn().mockImplementation(async (subject) => {
      return weights.get(`${subject.kind}:${subject.key}`) ?? 0;
    }),
    getMutedUntil: vi.fn().mockImplementation(async (subject) => {
      return mutes.get(`${subject.kind}:${subject.key}`) ?? null;
    }),
    setMutedUntil: vi.fn().mockImplementation(async (subject, until) => {
      mutes.set(`${subject.kind}:${subject.key}`, until);
    }),
    listEvents: vi.fn(),
    listActiveMutes: vi.fn(),
    deleteMute: vi.fn(),
  };

  beforeEach(() => {
    mutes.clear();
    weights.clear();
    vi.clearAllMocks();
  });

  it('mute 1 jam bila score 24 jam >= 3', async () => {
    const uc = new RecordAnonAbuseSignalUseCase(repo);
    await uc.execute({ clientIp: '1.2.3.4', signal: 'input_rejected' });
    await uc.execute({ clientIp: '1.2.3.4', signal: 'input_rejected' });
    await uc.execute({ clientIp: '1.2.3.4', signal: 'input_rejected' });

    expect(repo.setMutedUntil).toHaveBeenCalled();
    const until = mutes.get('ip:1.2.3.4');
    expect(until).toBeInstanceOf(Date);
    expect(until!.getTime()).toBeGreaterThan(Date.now());
  });

  it('assertAnonWriteAllowed menolak saat muted', async () => {
    mutes.set('ip:9.9.9.9', new Date(Date.now() + 60_000));
    await expect(
      assertAnonWriteAllowed(repo, { clientIp: '9.9.9.9', deviceId: null }),
    ).rejects.toBeInstanceOf(ForbiddenError);
  });

  it('assertAnonWriteAllowed lolos bila tidak mute', async () => {
    await expect(
      assertAnonWriteAllowed(repo, { clientIp: '8.8.8.8', deviceId: 'DEV12345678' }),
    ).resolves.toBeUndefined();
  });
});
