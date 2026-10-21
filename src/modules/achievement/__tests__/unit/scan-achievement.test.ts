import { describe, it, expect, beforeEach } from 'vitest';
import type { Achievement, AchievementCriteria } from '@/modules/achievement/domain/entities/achievement.entity';
import type { AchievementRepository, AwardTarget } from '@/modules/achievement/domain/repositories/achievement.repository';
import { ScanAchievementUseCase } from '@/modules/achievement/application/use-cases/scan-achievement.use-case';

/**
 * Repo palsu in-memory: cukup untuk menguji kontrak scan (anti-join +
 * idempotensi) tanpa DB. Implementasi SQL nyata diuji di integration test.
 */
class FakeRepo {
  awarded = new Set<string>();
  inboxCalls: string[] = [];

  constructor(private readonly candidates: AwardTarget[]) {}

  async findUnawardedCandidates(achievementId: string, _c: AchievementCriteria, limit: number) {
    // Simulasi anti-join: buang yang sudah punya award.
    return this.candidates
      .filter((c) => !this.awarded.has(`${achievementId}:${c.userId}`))
      .slice(0, limit)
      .map((c) => ({
        userId: c.userId,
        username: c.username,
        displayName: c.displayName,
        matchedAt: c.matchedAt,
      }));
  }

  async insertAward(target: AwardTarget): Promise<boolean> {
    const rows = await this.insertAwards([target]);
    return rows.length > 0;
  }

  async insertAwards(
    targets: AwardTarget[],
  ): Promise<Array<{ id: string; userId: string }>> {
    const inserted: Array<{ id: string; userId: string }> = [];
    for (const target of targets) {
      const key = `${target.achievementId}:${target.userId}`;
      if (this.awarded.has(key)) continue;
      this.awarded.add(key);
      inserted.push({ id: `01AWARD${String(this.awarded.size).padStart(18, '0')}`, userId: target.userId });
    }
    return inserted;
  }
}

const achievement: Achievement = {
  id: '01ACHIEVEMENT0000000000001',
  code: 'angkatan-ke-1',
  title: 'Angkatan Ke-1',
  description: 'Kohort pertama',
  category: 'kohort',
  rewardType: 'profile_border',
  badgeUrl: null,
  criteria: {
    source: 'registration',
    window: { from: '2026-01-01T00:00:00+07:00', to: '2027-01-01T00:00:00+07:00' },
  },
  family: null,
  level: null,
  isActive: true,
  createdAt: new Date(),
  updatedAt: null,
};

function makeCandidates(n: number): AwardTarget[] {
  return Array.from({ length: n }, (_, i) => ({
    achievementId: achievement.id,
    userId: `01USER${String(i).padStart(20, '0')}`,
    username: `user${i}`,
    displayName: `User ${i}`,
    matchedAt: new Date('2026-03-01T00:00:00Z'),
    context: null,
  }));
}

describe('ScanAchievementUseCase - idempotensi', () => {
  let repo: FakeRepo;
  let inboxCalls: string[];
  let useCase: ScanAchievementUseCase;

  beforeEach(() => {
    repo = new FakeRepo(makeCandidates(3));
    inboxCalls = [];
    const inbox = {
      execute: async (cmd: { userId: string }) => {
        inboxCalls.push(cmd.userId);
      },
      executeBatch: async (cmds: Array<{ userId: string }>) => {
        for (const cmd of cmds) inboxCalls.push(cmd.userId);
      },
    };
    useCase = new ScanAchievementUseCase(
      repo as unknown as AchievementRepository,
      inbox as never,
    );
  });

  it('scan pertama memberi 3 award + 3 notifikasi', async () => {
    const result = await useCase.execute({ achievement });
    expect(result).toEqual({ scanned: 3, awarded: 3 });
    expect(inboxCalls).toHaveLength(3);
  });

  it('scan kedua = 0 award baru (anti-join + UNIQUE)', async () => {
    await useCase.execute({ achievement });
    inboxCalls = [];
    const second = await useCase.execute({ achievement });
    expect(second).toEqual({ scanned: 0, awarded: 0 });
    expect(inboxCalls).toHaveLength(0);
  });

  it('source manual tidak pernah discan', async () => {
    const manual: Achievement = {
      ...achievement,
      criteria: { source: 'manual' },
      rewardType: 'badge',
    };
    const result = await useCase.execute({ achievement: manual });
    expect(result).toEqual({ scanned: 0, awarded: 0 });
  });

  it('achievement nonaktif yang discan tetap idempotent (dipanggil manual)', async () => {
    const inactive: Achievement = { ...achievement, isActive: false };
    await useCase.execute({ achievement: inactive });
    const second = await useCase.execute({ achievement: inactive });
    expect(second.awarded).toBe(0);
  });
});
