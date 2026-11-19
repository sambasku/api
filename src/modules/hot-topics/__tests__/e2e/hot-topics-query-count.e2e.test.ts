import { describe, it, expect, beforeAll } from 'vitest';
import { config } from 'dotenv';

const { parsed } = config({ path: '.env.test', quiet: true });
const hasTestDb = !!parsed?.DATABASE_URL;
if (parsed?.DATABASE_URL) process.env.DATABASE_URL = parsed.DATABASE_URL;

/**
 * G5: GET /hot-topics = 3 tab paralel → target ≤3 query Turso / request
 * (Promise.all searched + proposed + near_threshold).
 */
describe.skipIf(!hasTestDb)('Hot topics query budget (G5)', () => {
  beforeAll(async () => {
    const { getTestDb } = await import('@/shared/database/drizzle/test-client');
    const schema = await import('@/shared/database/drizzle/schema');
    const { truncateAll } = await import('@/shared/database/drizzle/test-utils');
    const db = getTestDb();
    await truncateAll(db);

    await db.insert(schema.languages).values({
      id: '01E2ELANGHTQC0000000000001',
      code: 'sbb',
      name: 'Sambas',
    });
    await db.insert(schema.users).values([
      {
        id: 'u_htqc1',
        username: 'htqcuser',
        displayName: 'Hot QC',
        email: 'htqc@test.com',
        passwordHash: 'bukan-hash-login',
      },
      ...[1, 2, 3].map((i) => ({
        id: `u_htqc_v${i}`,
        username: `htqcvoter${i}`,
        displayName: `Voter ${i}`,
        email: `htqcv${i}@test.com`,
        passwordHash: 'bukan-hash-login',
      })),
    ]);
    await db.insert(schema.words).values({
      id: 'w_htqc1',
      lemma: 'makatn',
      languageId: '01E2ELANGHTQC0000000000001',
      status: 'published',
      isVerified: false,
      createdBy: 'u_htqc1',
      wordType: 'word',
    });
    await db.insert(schema.meanings).values({
      id: 'm_htqc1',
      wordId: 'w_htqc1',
      definition: 'makan',
      status: 'published',
      isVerified: false,
      orderIndex: 0,
      createdBy: 'u_htqc1',
    });
    const now = new Date();
    await db.insert(schema.searchMisses).values({
      id: 'sm_htqc1',
      term: 'kwintal',
      direction: 'lemma',
      hitCount: 3,
      isVisible: true,
      lastSearchedAt: now,
      createdAt: now,
    });
    await db.insert(schema.contributions).values({
      id: 'c_htqc1',
      userId: 'u_htqc1',
      entityType: 'word',
      entityId: 'w_htqc1',
      action: 'create',
      status: 'pending',
      createdAt: now,
    });
    // Net = 3 → masuk near_threshold (2 ≤ abs(net) < 5)
    await db.insert(schema.votes).values(
      [1, 2, 3].map((i) => ({
        id: `v_htqc${i}`,
        entityType: 'meaning' as const,
        entityId: 'm_htqc1',
        userId: `u_htqc_v${i}`,
        value: 1,
        createdAt: now,
        updatedAt: now,
      })),
    );
  });

  it('listAllTabs <= 3 query (satu per tab, paralel)', async () => {
    const { createClient } = await import('@libsql/client');
    const { drizzle } = await import('drizzle-orm/libsql');
    const schema = await import('@/shared/database/drizzle/schema');
    const { HotTopicsRepositoryImpl } = await import(
      '../../infrastructure/hot-topics.repository.impl'
    );
    const client = createClient({ url: process.env.DATABASE_URL! });
    const realExecute = client.execute.bind(client);
    let queryCount = 0;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (client as any).execute = async (...args: unknown[]) => {
      queryCount++;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return (realExecute as any)(...args);
    };
    const repo = new HotTopicsRepositoryImpl(drizzle(client, { schema }));
    queryCount = 0;
    const result = await repo.listAllTabs(10);
    expect(result.searched.items.length).toBeGreaterThan(0);
    expect(result.proposed.items.length).toBeGreaterThan(0);
    expect(result.nearThreshold.items.length).toBeGreaterThan(0);
    expect(queryCount).toBeLessThanOrEqual(3);
  });
});
