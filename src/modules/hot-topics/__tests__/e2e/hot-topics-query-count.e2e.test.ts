import { describe, it, expect, beforeAll } from 'vitest';
import { config } from 'dotenv';
import { searchDayWib } from '@/shared/database/drizzle/schema/search-daily.schema';

const { parsed } = config({ path: '.env.test', quiet: true });
const hasTestDb = !!parsed?.DATABASE_URL;
if (parsed?.DATABASE_URL) process.env.DATABASE_URL = parsed.DATABASE_URL;

/**
 * G5: GET /hot-topics = 4 tab paralel → target ≤4 query Turso / request
 * (Promise.all searched + proposed + viewed + check).
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
    await db.insert(schema.users).values({
      id: 'u_htqc1',
      username: 'htqcuser',
      displayName: 'Hot QC',
      email: 'htqc@test.com',
      passwordHash: 'bukan-hash-login',
    });
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
    // Views hari ini → masuk tab viewed (in_window).
    await db.insert(schema.wordViews).values([
      {
        wordId: 'w_htqc1',
        day: searchDayWib(now),
        viewerKey: 'u:u_htqc1',
        count: 1,
      },
      {
        wordId: 'w_htqc1',
        day: searchDayWib(now),
        viewerKey: 'd:device-htqc',
        count: 1,
      },
    ]);
    // Downvote aktif → masuk tab check.
    await db.insert(schema.votes).values({
      id: 'v_htqc1',
      userId: 'u_htqc1',
      entityType: 'meaning',
      entityId: 'm_htqc1',
      value: -1,
      createdAt: now,
      updatedAt: now,
    });
  });

  it('listAllTabs <= 4 query (satu per tab, paralel)', async () => {
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
    expect(result.viewed.items.length).toBeGreaterThan(0);
    expect(result.viewed.items[0]?.viewCount).toBe(2);
    expect(result.viewed.items[0]?.inWindow).toBe(true);
    expect(result.check.items.length).toBeGreaterThan(0);
    expect(result.check.items[0]?.downvotes).toBe(1);
    expect(result.check.items[0]?.inWindow).toBe(true);
    expect(queryCount).toBeLessThanOrEqual(4);
  });
});
