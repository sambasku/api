import { beforeEach, describe, expect, it, vi } from 'vitest';
import { LiftAbuseMuteUseCase } from '@/modules/abuse/application/use-cases/lift-abuse-mute.use-case';
import { RecordAbuseSignalUseCase } from '@/shared/moderation/record-abuse-signal.use-case';
import { RecordAnonAbuseSignalUseCase } from '@/shared/moderation/record-anon-abuse-signal.use-case';
import type { UgcAbuseEventRepository } from '@/shared/moderation/ugc-abuse-event.repository';
import type { UgcAnonAbuseRepository } from '@/shared/moderation/ugc-anon-abuse.repository';

// Ledger in-memory: semua event "baru", jadi tiap jendela (24h/7d/30d) = total bobot.
describe('LiftAbuseMuteUseCase', () => {
  let userScore = 0;
  let mutedUntil: Date | null = null;
  const anonScore = new Map<string, number>();
  const anonMutes = new Map<string, Date>();

  const abuseRepo = {
    record: vi.fn(async (input) => {
      userScore += input.weight ?? 1;
      return { id: '01EVENT', ...input, weight: input.weight ?? 1, entityType: null, entityId: null, meta: null, createdAt: new Date() };
    }),
    sumWeightSince: vi.fn(async () => userScore),
    countSignalSince: vi.fn(async () => 0),
    listByUser: vi.fn(),
    listAll: vi.fn(),
    findRecentBodyHashes: vi.fn(),
  } as unknown as UgcAbuseEventRepository;

  const key = (s: { kind: string; key: string }) => `${s.kind}:${s.key}`;
  const anonRepo: UgcAnonAbuseRepository = {
    record: vi.fn(async (input) => {
      anonScore.set(key(input.subject), (anonScore.get(key(input.subject)) ?? 0) + (input.weight ?? 1));
    }),
    sumWeightSince: vi.fn(async (s) => anonScore.get(key(s)) ?? 0),
    getMutedUntil: vi.fn(async (s) => anonMutes.get(key(s)) ?? null),
    setMutedUntil: vi.fn(async (s, until) => {
      anonMutes.set(key(s), until);
    }),
    listEvents: vi.fn(),
    listActiveMutes: vi.fn(),
    deleteMute: vi.fn(async (s) => anonMutes.delete(key(s))),
  };

  const userRepo = {
    findById: vi.fn(async () => ({ id: '01USER', role: 'contributor', deletedAt: null, contributeMutedUntil: mutedUntil })),
    getContributeGate: vi.fn(async () => ({ isActive: true, canContribute: true, contributeMutedUntil: mutedUntil })),
    setContributeMutedUntil: vi.fn(async (_id: string, until: Date | null) => {
      mutedUntil = until;
      return true;
    }),
    setCanContribute: vi.fn(async () => true),
    setIsActive: vi.fn(async () => true),
  };
  const auditRepo = { record: vi.fn(async () => undefined) };

  beforeEach(() => {
    userScore = 0;
    mutedUntil = null;
    anonScore.clear();
    anonMutes.clear();
    vi.clearAllMocks();
  });

  it('akun: setelah cabut, satu sinyal berikutnya tidak memicu mute lagi', async () => {
    const record = new RecordAbuseSignalUseCase(abuseRepo, userRepo as never, {} as never, auditRepo as never);
    const lift = new LiftAbuseMuteUseCase(abuseRepo, anonRepo, userRepo as never, auditRepo as never);

    for (let i = 0; i < 3; i++) await record.execute({ userId: '01USER', signal: 'input_rejected' });
    expect(mutedUntil).toBeInstanceOf(Date);

    await lift.liftUser({ userId: '01USER', actorId: '01ADMIN' });
    expect(mutedUntil).toBeNull();
    expect(userScore).toBe(0);
    expect(auditRepo.record).toHaveBeenCalledWith(expect.objectContaining({ action: 'lift_contribute_mute' }));

    await record.execute({ userId: '01USER', signal: 'input_rejected' });
    expect(mutedUntil).toBeNull();
  });

  it('anon: setelah cabut, satu sinyal berikutnya tidak memicu mute lagi', async () => {
    const record = new RecordAnonAbuseSignalUseCase(anonRepo);
    const lift = new LiftAbuseMuteUseCase(abuseRepo, anonRepo, userRepo as never, auditRepo as never);

    for (let i = 0; i < 3; i++) await record.execute({ clientIp: '1.2.3.4', signal: 'input_rejected' });
    expect(anonMutes.get('ip:1.2.3.4')).toBeInstanceOf(Date);

    const res = await lift.liftAnon({ subject: { kind: 'ip', key: '1.2.3.4' }, actorId: '01ADMIN' });
    expect(res.removed).toBe(true);
    expect(anonScore.get('ip:1.2.3.4')).toBe(0);

    await record.execute({ clientIp: '1.2.3.4', signal: 'input_rejected' });
    expect(anonMutes.has('ip:1.2.3.4')).toBe(false);
  });
});
