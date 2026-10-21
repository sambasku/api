import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { config } from 'dotenv';
import { eq } from 'drizzle-orm';

const { parsed } = config({ path: '.env.test', quiet: true });
const hasTestDb = !!parsed?.DATABASE_URL;
if (parsed?.DATABASE_URL) process.env.DATABASE_URL = parsed.DATABASE_URL;

/**
 * Budget subrequest Cloudflare (#103): tiap query drizzle = 1 subrequest HTTP
 * ke Turso (limit default 50/invocation). Jalur baca achievement tidak boleh
 * N+1: katalog+kepemilikan = 1 query LEFT JOIN, scan = 1 query kandidat.
 */
describe.skipIf(!hasTestDb)('Budget subrequest - jalur baca achievement', () => {
  let queryCount = 0;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let spyDb: any;
  let userA = '';
  let userB = '';

  beforeAll(async () => {
    const { getTestDb } = await import('@/shared/database/drizzle/test-client');
    const schema = await import('@/shared/database/drizzle/schema');
    const { users, userAchievements, achievements } = schema;
    const { truncateAll } = await import('@/shared/database/drizzle/test-utils');
    const seedDb = getTestDb();
    await truncateAll(seedDb);

    userA = '01ACHQCUSER00000000000001A';
    userB = '01ACHQCUSER00000000000001B';
    await seedDb.insert(users).values([
      {
        id: userA,
        username: 'qcach1',
        displayName: 'QC Achievement 1',
        email: 'qcach1@test.com',
        passwordHash: 'bukan-hash-login',
      },
      {
        id: userB,
        username: 'qcach2',
        displayName: 'QC Achievement 2',
        email: 'qcach2@test.com',
        passwordHash: 'bukan-hash-login',
      },
    ]);

    // 12 achievement: 4 border + 4 badge + 4 sticker, sebagian dimiliki A.
    const rows = Array.from({ length: 12 }, (_, i) => ({
      id: `01ACH${String(i).padStart(22, '0')}`,
      code: `qc-ach-${i}`,
      title: `QC Achievement ${i}`,
      description: 'Fixture budget query',
      category: 'kohort',
      rewardType: (['profile_border', 'badge', 'sticker'] as const)[i % 3]!,
      badgeUrl: `https://cdn.jsdelivr.net/gh/sambasku/images@main/assets/achievements/qc-${i}.png`,
      criteria: JSON.stringify({ source: 'registration' }),
      isActive: true,
      createdAt: new Date(),
    }));
    await seedDb.insert(achievements).values(rows);

    await seedDb.insert(userAchievements).values(
      rows.slice(0, 6).map((r, i) => ({
        id: `01AWA${String(i).padStart(22, '0')}`,
        achievementId: r.id,
        userId: userA,
        awardedAt: new Date(),
        grantedVia: 'scan' as const,
      })),
    );
  });

  beforeEach(async () => {
    const { createClient } = await import('@libsql/client');
    const { drizzle } = await import('drizzle-orm/libsql');
    const schema = await import('@/shared/database/drizzle/schema');
    const client = createClient({ url: process.env.DATABASE_URL! });
    const realExecute = client.execute.bind(client);
    queryCount = 0;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (client as any).execute = async (...args: unknown[]) => {
      queryCount++;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return (realExecute as any)(...args);
    };
    spyDb = drizzle(client, { schema });
  });

  it('katalog milik user = 1 query (LEFT JOIN kepemilikan)', async () => {
    const { AchievementRepositoryImpl } = await import(
      '@/modules/achievement/infrastructure/achievement.repository.impl'
    );
    const repo = new AchievementRepositoryImpl(spyDb);
    queryCount = 0;
    const result = await repo.listForUser(userA, { limit: 20 });
    expect(result.items.length).toBeGreaterThan(0);
    expect(queryCount).toBeLessThanOrEqual(1);
    // Kepemilikan terdeteksi tanpa query tambahan.
    expect(result.items.some((i) => i.userAchievementId !== null)).toBe(true);
  });

  it('katalog publik = 1 query', async () => {
    const { AchievementRepositoryImpl } = await import(
      '@/modules/achievement/infrastructure/achievement.repository.impl'
    );
    const repo = new AchievementRepositoryImpl(spyDb);
    queryCount = 0;
    const result = await repo.listActive({ limit: 20 });
    expect(result.items.length).toBeGreaterThan(0);
    expect(queryCount).toBeLessThanOrEqual(1);
  });

  it('scan kandidat = 1 query anti-join (bukan N+1)', async () => {
    const { AchievementRepositoryImpl } = await import(
      '@/modules/achievement/infrastructure/achievement.repository.impl'
    );
    const repo = new AchievementRepositoryImpl(spyDb);
    const achievement = await repo.findByCode('qc-ach-6');
    expect(achievement).toBeTruthy();
    queryCount = 0;
    const candidates = await repo.findUnawardedCandidates(
      achievement!.id,
      achievement!.criteria,
      100,
    );
    expect(candidates.length).toBeGreaterThan(0);
    expect(queryCount).toBeLessThanOrEqual(1);
    // Anti-join: user yang sudah punya achievement lain tetap muncul,
    // yang sudah punya achievement INI tidak.
    expect(candidates.some((c) => c.userId === userA || c.userId === userB)).toBe(true);
  });

  it('scan batch: kandidat semua katalog = 1 roundtrip db.batch', async () => {
    const { AchievementRepositoryImpl } = await import(
      '@/modules/achievement/infrastructure/achievement.repository.impl'
    );
    const repo = new AchievementRepositoryImpl(spyDb);
    const all = await repo.listActive({ limit: 50 });
    const items = all.items.map((i) => ({ id: i.id, criteria: i.criteria }));
    queryCount = 0;
    const map = await repo.findUnawardedCandidatesBatch(items, 100);
    expect(map.size).toBe(items.length);
    // db.batch mengirim satu roundtrip ke Turso (statement di dalamnya
    // dieksekusi server-side, bukan subrequest HTTP terpisah).
    expect(queryCount).toBeLessThanOrEqual(1);
  });

  it('award batch: banyak award = 1 INSERT (bukan N+1 write)', async () => {
    const { AchievementRepositoryImpl } = await import(
      '@/modules/achievement/infrastructure/achievement.repository.impl'
    );
    const repo = new AchievementRepositoryImpl(spyDb);
    const boot = await repo.findByCode('qc-ach-7');
    expect(boot).toBeTruthy();
    const targets = Array.from({ length: 5 }, (_, i) => ({
      achievementId: boot!.id,
      userId: `01ACHQB${String(i).padStart(19, '0')}`,
      username: `qcb${i}`,
      displayName: `QC Batch ${i}`,
      matchedAt: new Date(),
      context: null,
    }));
    queryCount = 0;
    // FK user tidak ada di fixture -> insert gagal; yang diuji adalah
    // JUMLAH query, bukan hasil insert.
    await repo.insertAwards(targets, 'scan').catch(() => undefined);
    expect(queryCount).toBeLessThanOrEqual(1);
  });

  it('profil publik border = 1 query (lookup user + LEFT JOIN border)', async () => {
    const { PublicUserRepositoryImpl } = await import(
      '@/modules/user/infrastructure/public-user.repository.impl'
    );
    const repo = new PublicUserRepositoryImpl(spyDb);
    const { getTestDb } = await import('@/shared/database/drizzle/test-client');
    const schema = await import('@/shared/database/drizzle/schema');
    // Pasang border aktif user A.
    const [firstAward] = await getTestDb()
      .select({ id: schema.userAchievements.id })
      .from(schema.userAchievements)
      .limit(1);
    await getTestDb()
      .update(schema.users)
      .set({ activeBorderId: firstAward!.id })
      .where(eq(schema.users.id, userA));

    queryCount = 0;
    const row = await repo.findPublicByUsername('qcach1');
    expect(row).toBeTruthy();
    // 1 query user+border, 1 query roles = 2.
    expect(queryCount).toBeLessThanOrEqual(2);
  });
});
