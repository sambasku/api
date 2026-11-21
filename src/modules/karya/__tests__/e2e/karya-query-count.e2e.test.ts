import { describe, it, expect, beforeAll } from 'vitest';
import { config } from 'dotenv';

const { parsed } = config({ path: '.env.test', quiet: true });
const hasTestDb = !!parsed?.DATABASE_URL;
if (parsed?.DATABASE_URL) process.env.DATABASE_URL = parsed.DATABASE_URL;

describe.skipIf(!hasTestDb)('Karya query budget', () => {
  beforeAll(async () => {
    const { getTestDb } = await import('@/shared/database/drizzle/test-client');
    const { karyas, karyaCredits } = await import(
      '@/shared/database/drizzle/schema'
    );
    const db = getTestDb();
    const now = new Date();
    await db
      .insert(karyas)
      .values(
        [1, 2].map((i) => ({
          id: `01EVKARYABUDGET0000000000${i}`,
          slug: `budget-karya-${i}`,
          title: `Lagu Budget ${i}`,
          kind: 'music' as const,
          year: 2020 + i,
          sambasConnectionsJson: JSON.stringify([
            { type: 'theme', note: 'Berbau Sambas' },
          ]),
          accessLinksJson: '[]',
          sourcesJson: '[]',
          relatedJson: '[]',
          publishStatus: 'published' as const,
          musicIsCover: false,
          publishedAt: now,
          createdAt: now,
          updatedAt: now,
        })),
      )
      .onConflictDoNothing();
    await db
      .insert(karyaCredits)
      .values(
        [1, 2].map((i) => ({
          id: `01EVKARYACREDITBUDGET00000${i}`,
          karyaId: `01EVKARYABUDGET0000000000${i}`,
          role: 'vocal',
          nameText: `Penyanyi ${i}`,
          sortOrder: 0,
          createdAt: now,
        })),
      )
      .onConflictDoNothing();
  });

  it('daftar publik = maksimal 2 query (list + credits batch)', async () => {
    const { createClient } = await import('@libsql/client');
    const { drizzle } = await import('drizzle-orm/libsql');
    const schema = await import('@/shared/database/drizzle/schema');
    const { KaryaRepositoryImpl } = await import(
      '../../infrastructure/karya.repository.impl'
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
    const repo = new KaryaRepositoryImpl(drizzle(client, { schema }));
    const items = await repo.listPublic({ kind: 'music', q: 'Budget' });
    expect(items.length).toBeGreaterThanOrEqual(2);
    expect(items[0]?.credits.length).toBeGreaterThanOrEqual(1);
    expect(queryCount).toBeLessThanOrEqual(2);
  });
});
