import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { config } from 'dotenv';

const { parsed } = config({ path: '.env.test', quiet: true });
const hasTestDb = !!parsed?.DATABASE_URL;
if (parsed?.DATABASE_URL) process.env.DATABASE_URL = parsed.DATABASE_URL;

/**
 * Budget subrequest Cloudflare (#103 / 0101): satu request deck = satu
 * Worker invocation, tiap query drizzle = 1 subrequest HTTP ke Turso.
 * Deck per makna harus tetap hemat: 1 query utama + 1 counts batch
 * (+1 slot buffer untuk fallback terjemahan bersyarat).
 */
describe.skipIf(!hasTestDb)('Subrequest budget 0101 - query count deck per makna', () => {
  let queryCount = 0;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let db: any;

  beforeAll(async () => {
    const { getTestDb } = await import('@/shared/database/drizzle/test-client');
    const schema = await import('@/shared/database/drizzle/schema');
    const { users, words, meanings, languages, wordClasses } = schema;
    const { truncateAll } = await import('@/shared/database/drizzle/test-utils');
    const seedDb = getTestDb();

    await truncateAll(seedDb);
    await seedDb
      .insert(languages)
      .values({ id: '01E3LANGQC0000000000000001', code: 'sbq', name: 'Sambas QC' });

    await seedDb.insert(users).values({
      id: 'u_dqc1',
      username: 'dqcuser',
      displayName: 'DQC User',
      email: 'dqc@test.com',
      passwordHash: 'bukan-hash-login',
    });

    // 20 kata x 2 makna = 40 kartu deck; definisi campuran (ada yang perlu
    // fallback terjemahan) supaya jalur attach ikut teruji.
    const now = Date.now();
    const wordRows = Array.from({ length: 20 }, (_, i) => ({
      id: `01DQCW${String(i).padStart(19, '0')}`,
      lemma: `lemma${i}`,
      languageId: '01E3LANGQC0000000000000001',
      status: 'published',
      isVerified: true,
      verifiedAt: new Date(now - i * 1000),
      createdBy: 'u_dqc1',
      wordType: 'word',
    }));
    await seedDb.insert(words).values(wordRows);
    await seedDb
      .insert(wordClasses)
      .values({ id: '01DQCCLASS00000000000001', code: 'n', name: 'Nomina', alias: 'Kata Benda' });

    const meaningRows = wordRows.flatMap((w, i) =>
      Array.from({ length: 2 }, (_, j) => ({
        id: `01DQCM${String(i).padStart(10, '0')}${String(j).padStart(10, '0')}`,
        wordId: w.id,
        definition: j === 0 ? `definisi ${i}-${j}` : '-',
        isHaveDefinition: j === 0,
        orderIndex: j,
        status: 'published',
        // Kelas kata menempel di MAKNA; separuh null supaya LEFT JOIN teruji.
        wordClassId: j === 0 ? '01DQCCLASS00000000000001' : null,
      })),
    );
    await seedDb.insert(meanings).values(meaningRows);
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

  it('deck per makna pakai <= 3 query per halaman (20 kartu)', async () => {
    const { VoteRepositoryImpl } = await import(
      '@/modules/vote/infrastructure/vote.repository.impl'
    );
    queryCount = 0;
    const repo = new VoteRepositoryImpl(db);
    const page = await repo.listDeckMeanings('u_dqc1', { limit: 20, randomize: false });
    expect(page.items.length).toBeGreaterThan(0);
    // Target: 1 query utama + 1 countMany batch (+1 slot buffer fallback
    // terjemahan untuk makna tanpa definisi).
    expect(queryCount).toBeLessThanOrEqual(3);

    // Kelas kata ikut LEFT JOIN yang sama - bukan query tambahan.
    const withClass = page.items.filter((m) => m.wordClass !== null);
    expect(withClass.length).toBeGreaterThan(0);
    expect(withClass[0]!.wordClass!.code).toBe('n');
    expect(withClass[0]!.wordClass!.alias).toBe('Kata Benda');
    expect(page.items.some((m) => m.wordClass === null)).toBe(true);
  });
});
