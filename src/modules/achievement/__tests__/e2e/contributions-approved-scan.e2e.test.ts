import { describe, it, expect, beforeAll } from 'vitest';
import { config } from 'dotenv';

const { parsed } = config({ path: '.env.test', quiet: true });
const hasTestDb = !!parsed?.DATABASE_URL;
if (parsed?.DATABASE_URL) process.env.DATABASE_URL = parsed.DATABASE_URL;

/**
 * G1: source `contributions_approved` (aggregate) - di atas threshold
 * kebagian, di bawah tidak; soft-deleted / pending tidak hitung.
 */
describe.skipIf(!hasTestDb)('Achievement aggregate - contributions_approved', () => {
  let repo: InstanceType<
    typeof import('@/modules/achievement/infrastructure/achievement.repository.impl').AchievementRepositoryImpl
  >;
  let achievementId = '';
  let userPass = '';
  let userFail = '';

  beforeAll(async () => {
    const { getTestDb } = await import('@/shared/database/drizzle/test-client');
    const schema = await import('@/shared/database/drizzle/schema');
    const { truncateAll } = await import('@/shared/database/drizzle/test-utils');
    const { AchievementRepositoryImpl } = await import(
      '@/modules/achievement/infrastructure/achievement.repository.impl'
    );
    const db = getTestDb();
    await truncateAll(db);

    userPass = '01ACHCONTRIBUSER0000000001';
    userFail = '01ACHCONTRIBUSER0000000002';
    await db.insert(schema.users).values([
      {
        id: userPass,
        username: 'contribpass',
        displayName: 'Lolos Threshold',
        email: 'contribpass@test.com',
        passwordHash: 'x',
      },
      {
        id: userFail,
        username: 'contribfail',
        displayName: 'Di Bawah Threshold',
        email: 'contribfail@test.com',
        passwordHash: 'x',
      },
    ]);

    // userPass: 3 word approved. userFail: 1 word approved (+ 2 pending diabaikan).
    const now = new Date();
    await db.insert(schema.contributions).values([
      {
        id: '01ACHCONTRIB00000000000001',
        userId: userPass,
        entityType: 'word',
        entityId: '01WORD0000000000000000001',
        action: 'create',
        status: 'approved',
        createdAt: now,
      },
      {
        id: '01ACHCONTRIB00000000000002',
        userId: userPass,
        entityType: 'word',
        entityId: '01WORD0000000000000000002',
        action: 'create',
        status: 'corrected',
        createdAt: now,
      },
      {
        id: '01ACHCONTRIB00000000000003',
        userId: userPass,
        entityType: 'word',
        entityId: '01WORD0000000000000000003',
        action: 'create',
        status: 'approved',
        createdAt: now,
      },
      {
        id: '01ACHCONTRIB00000000000004',
        userId: userFail,
        entityType: 'word',
        entityId: '01WORD0000000000000000004',
        action: 'create',
        status: 'approved',
        createdAt: now,
      },
      {
        id: '01ACHCONTRIB00000000000005',
        userId: userFail,
        entityType: 'word',
        entityId: '01WORD0000000000000000005',
        action: 'create',
        status: 'pending',
        createdAt: now,
      },
      {
        id: '01ACHCONTRIB00000000000006',
        userId: userFail,
        entityType: 'word',
        entityId: '01WORD0000000000000000006',
        action: 'create',
        status: 'approved',
        createdAt: now,
        deletedAt: now,
      },
    ]);

    achievementId = '01ACHCONTRIBACH00000000001';
    await db.insert(schema.achievements).values({
      id: achievementId,
      code: 'kata-tiga',
      title: 'Tiga Kata',
      description: 'Tiga kontribusi kata disetujui',
      category: 'kontribusi',
      rewardType: 'badge',
      badgeUrl: null,
      criteria: JSON.stringify({
        source: 'contributions_approved',
        threshold: 3,
        filters: { entity_type: 'word' },
      }),
      family: 'kata-disetujui',
      level: 1,
      isActive: true,
      createdAt: now,
    });

    repo = new AchievementRepositoryImpl(db);
  });

  it('hanya user di atas threshold yang jadi kandidat', async () => {
    const candidates = await repo.findUnawardedCandidates(
      achievementId,
      {
        source: 'contributions_approved',
        threshold: 3,
        filters: { entity_type: 'word' },
      },
      100,
    );
    const ids = candidates.map((c) => c.userId);
    expect(ids).toContain(userPass);
    expect(ids).not.toContain(userFail);
  });

  it('scan award idempotent untuk aggregate source', async () => {
    const { ScanAchievementUseCase } = await import(
      '@/modules/achievement/application/use-cases/scan-achievement.use-case'
    );
    const achievement = await repo.findById(achievementId);
    expect(achievement).toBeTruthy();
    const useCase = new ScanAchievementUseCase(repo);
    const first = await useCase.execute({ achievement: achievement! });
    expect(first.awarded).toBe(1);
    const second = await useCase.execute({ achievement: achievement! });
    expect(second.awarded).toBe(0);
  });
});
