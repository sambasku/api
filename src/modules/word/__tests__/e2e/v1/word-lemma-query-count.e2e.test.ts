import { describe, it, expect, beforeAll } from 'vitest';
import { config } from 'dotenv';

// Pastikan .env.test (DB test) dipakai SEBELUM app di-import (Section 10)
const { parsed } = config({ path: '.env.test', quiet: true });
const hasTestDb = !!parsed?.DATABASE_URL;
if (parsed?.DATABASE_URL) process.env.DATABASE_URL = parsed?.DATABASE_URL;

/**
 * Budget subrequest Cloudflare (#103): GET /words/lemma/:lemma dulunya 4
 * round-trip Turso (resolusi id → word+join → meanings → children batch).
 * Fuse ke findPublishedDetailByLemma = 2 (word+meanings batch, children batch).
 * Spy menempel di client libsql yang dipakai APP (singleton client.ts) -
 * execute() dan batch() masing-masing = 1 request HTTP Hrana.
 */
describe.skipIf(!hasTestDb)('Subrequest budget - GET /words/lemma/:lemma', () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let app: any;
  let requestCount = 0;

  beforeAll(async () => {
    const { getTestDb } = await import('@/shared/database/drizzle/test-client');
    const { languages, words } = await import('@/shared/database/drizzle/schema');
    const { truncateAll } = await import('@/shared/database/drizzle/test-utils');
    const seedDb = getTestDb();
    await truncateAll(seedDb);
    await seedDb.insert(languages).values({ id: '01E2ELANGSMB', code: 'smb', name: 'Sambas' });
    await seedDb.insert(words).values({
      id: '01E2WLEMMAQC000000000001',
      languageId: '01E2ELANGSMB',
      lemma: 'jabbong',
      status: 'published',
    });

    // Client SINGLETON yang sama dipakai app.ts (db drizzle di atasnya).
    const { client } = await import('@/shared/database/drizzle/client');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const c = client as any;
    const origExecute = c.execute.bind(c);
    const origBatch = c.batch.bind(c);
    c.execute = async (...args: unknown[]) => {
      requestCount += 1;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return (origExecute as any)(...args);
    };
    c.batch = async (...args: unknown[]) => {
      requestCount += 1;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return (origBatch as any)(...args);
    };

    const appModule = await import('@/app');
    app = appModule.app;
  });

  it('detail by lemma <= 2 request Hrana', async () => {
    const res = await app.request('/api/v1/words/lemma/jabbong');
    expect(res.status).toBe(200);
    // Guard anti false-positive: spy harus benar-benar terpanggil.
    expect(requestCount).toBeGreaterThan(0);
    expect(requestCount).toBeLessThanOrEqual(2);
  });
});
