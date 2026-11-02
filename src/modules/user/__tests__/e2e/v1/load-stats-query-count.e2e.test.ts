import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { config } from 'dotenv';

const { parsed } = config({ path: '.env.test', quiet: true });
const hasTestDb = !!parsed?.DATABASE_URL;
if (parsed?.DATABASE_URL) process.env.DATABASE_URL = parsed.DATABASE_URL;

/**
 * Budget read-path leveling: loadStats wajib 1 Turso execute
 * (aggregate CROSS JOIN + streak JSON), bukan N subquery + streak terpisah.
 */
describe.skipIf(!hasTestDb)('loadStats query budget', () => {
  let queryCount = 0;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let db: any;

  beforeAll(async () => {
    const { getTestDb } = await import('@/shared/database/drizzle/test-client');
    const schema = await import('@/shared/database/drizzle/schema');
    const { truncateAll } = await import('@/shared/database/drizzle/test-utils');
    const seedDb = getTestDb();

    await truncateAll(seedDb);
    await seedDb.insert(schema.users).values({
      id: 'u_lsqc1',
      username: 'lsqcuser',
      displayName: 'LS QC',
      email: 'lsqc@test.com',
      passwordHash: 'bukan-hash-login',
    });
    await seedDb.insert(schema.languages).values({
      id: '01E2ELANGLSQC000000000001',
      code: 'sbb',
      name: 'Sambas',
    });
    await seedDb.insert(schema.words).values({
      id: 'w_lsqc1',
      lemma: 'makatn',
      languageId: '01E2ELANGLSQC000000000001',
      status: 'published',
      isVerified: true,
      verifiedAt: new Date(),
      createdBy: 'u_lsqc1',
      wordType: 'word',
    });
    await seedDb.insert(schema.contributions).values({
      id: '01LSQC0000000000000000001',
      userId: 'u_lsqc1',
      entityType: 'word',
      entityId: 'w_lsqc1',
      action: 'create',
      status: 'approved',
    });
    const now = Date.now();
    await seedDb.insert(schema.activityEvents).values({
      id: '01LSQCAE00000000000000001',
      kind: 'word_created',
      actorId: 'u_lsqc1',
      targetWordId: 'w_lsqc1',
      targetId: 'w_lsqc1',
      occurredAt: new Date(now),
      payload: null,
    });
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
    db = drizzle(client, { schema });
  });

  it('loadStats pakai tepat 1 query (stats + leveling + streak)', async () => {
    const { PublicUserRepositoryImpl } = await import(
      '@/modules/user/infrastructure/public-user.repository.impl'
    );
    queryCount = 0;
    const repo = new PublicUserRepositoryImpl(db);
    const stats = await repo.loadStats('u_lsqc1');
    expect(stats.wordsApproved).toBe(1);
    expect(stats.leveling.points).toBeGreaterThanOrEqual(15);
    expect(stats.leveling.streakDays).toBeGreaterThanOrEqual(1);
    expect(queryCount).toBe(1);
  });
});
