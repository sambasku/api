import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { config } from 'dotenv';

const { parsed } = config({ path: '.env.test', quiet: true });
const hasTestDb = !!parsed?.DATABASE_URL;
if (parsed?.DATABASE_URL) process.env.DATABASE_URL = parsed.DATABASE_URL;

/**
 * Budget subrequest Cloudflare (#103): satu request = satu Worker
 * invocation, tiap query drizzle = 1 subrequest HTTP ke Turso.
 * Limit default 50/invocation → N+1 per baris meledak di halaman penuh.
 *
 * Spy: satu libsql client buatan sendiri di-wrap `execute` → hitung semua
 * query keluar dari koneksi itu, lalu db drizzle dibangun di atasnya.
 */
describe.skipIf(!hasTestDb)('Subrequest budget #103 - query count per halaman', () => {
  let queryCount = 0;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let db: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let spyDb: any;

  beforeAll(async () => {
    const { getTestDb } = await import('@/shared/database/drizzle/test-client');
    const schema = await import('@/shared/database/drizzle/schema');
    const { users, words, searchMisses, activityEvents, languages } = schema;
    const { truncateAll } = await import('@/shared/database/drizzle/test-utils');
    const seedDb = getTestDb();

    await truncateAll(seedDb);
    await seedDb
      .insert(languages)
      .values({ id: '01E2ELANGQC00000000000001', code: 'sbb', name: 'Sambas' });

    await seedDb.insert(users).values({
      id: 'u_qc1',
      username: 'qcuser',
      displayName: 'QC User',
      email: 'qc@test.com',
      passwordHash: 'bukan-hash-login',
    });
    await seedDb.insert(words).values({
      id: 'w_qc1',
      lemma: 'makatn',
      languageId: '01E2ELANGQC00000000000001',
      status: 'published',
      isVerified: true,
      verifiedAt: new Date(),
      createdBy: 'u_qc1',
      wordType: 'word',
    });
    await seedDb.insert(searchMisses).values({ id: 'sm_qc1', term: 'kwintal' });

    const now = Date.now();
    const rows = Array.from({ length: 25 }, (_, i) => ({
      id: `01QC${String(i).padStart(22, '0')}`,
      kind: i % 5 === 0 ? 'search_miss' : i % 3 === 0 ? 'word_verified' : 'vote_word',
      actorId: 'u_qc1',
      targetWordId: i % 5 === 0 ? null : 'w_qc1',
      targetId: i % 5 === 0 ? 'sm_qc1' : 'w_qc1',
      occurredAt: new Date(now - i * 1000),
      // search_miss payload null = jalur bodyFor/lemma read-time ikut teruji.
      payload:
        i % 5 === 0
          ? null
          : i % 2 === 0
            ? '"makatn" sudah pas'
            : '"makatn" perlu dicek ulang',
    }));
    await seedDb.insert(activityEvents).values(rows);
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
    db = spyDb;
  });

  it('feed home pakai <= 3 query per halaman (25 baris)', async () => {
    const { ActivityEventFeedRepositoryImpl } = await import(
      '@/modules/activity/infrastructure/activity-event-feed.repository.impl'
    );
    queryCount = 0;
    const repo = new ActivityEventFeedRepositoryImpl(db);
    const items = await repo.listFeed(25);
    expect(items.length).toBeGreaterThan(0);
    // Target refactor: 1 selectVisible (+2 slot buffer).
    expect(queryCount).toBeLessThanOrEqual(3);
  });

  it('profil publik mode merge pakai <= 4 query (lookup user + 1 feed)', async () => {
    const { ActivityEventFeedRepositoryImpl } = await import(
      '@/modules/activity/infrastructure/activity-event-feed.repository.impl'
    );
    const { GetPublicActivityUseCase } = await import(
      '@/modules/user/application/use-cases/get-public-activity.use-case'
    );
    const feedRepo = new ActivityEventFeedRepositoryImpl(spyDb);
    // Lookup user = 1 query manual (di luar spy hitung otomatis: +1 di bawah).
    const userRepo = {
      findPublicByUsername: async () => {
        queryCount++;
        return { id: 'u_qc1', username: 'qcuser' };
      },
    };
    queryCount = 0;
    const uc = new GetPublicActivityUseCase(userRepo as never, feedRepo);
    const page = await uc.execute('qcuser');
    expect(page.items.length).toBeGreaterThan(0);
    // Target refactor: 1 user lookup + 1 listPublicByActor('merged').
    expect(queryCount).toBeLessThanOrEqual(4);
  });
});
