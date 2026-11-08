import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { config } from 'dotenv';

const { parsed } = config({ path: '.env.test', quiet: true });
const hasTestDb = !!parsed?.DATABASE_URL;
if (parsed?.DATABASE_URL) process.env.DATABASE_URL = parsed.DATABASE_URL;

describe.skipIf(!hasTestDb)('Layanan query budget', () => {
  let queryCount = 0;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let db: any;
  const KEC_ID = '01EVKECQBUDGETLAYANAN000001';

  beforeAll(async () => {
    const { getTestDb } = await import('@/shared/database/drizzle/test-client');
    const { regions, layanans } = await import('@/shared/database/drizzle/schema');
    const { truncateAll } = await import('@/shared/database/drizzle/test-utils');
    const seedDb = getTestDb();
    await truncateAll(seedDb);
    await seedDb.insert(regions).values({
      id: KEC_ID,
      slug: 'kec-layanan-budget',
      name: 'Kecamatan Layanan',
      type: 'kecamatan',
      status: 'published',
    });
    const now = new Date();
    await seedDb.insert(layanans).values(
      Array.from({ length: 4 }, (_, i) => ({
        id: `01ELAYBUDGET${String(i).padStart(14, '0')}`,
        slug: `layanan-budget-${i}`,
        category: i % 2 === 0 ? ('ambulance' as const) : ('fire' as const),
        name: `Layanan ${i}`,
        phone: `08123000000${i}`,
        regionId: KEC_ID,
        publishStatus: 'published' as const,
        createdAt: now,
        updatedAt: now,
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
    db = drizzle(client, { schema });
  });

  it('daftar satu kecamatan = 1 query', async () => {
    const { LayananRepositoryImpl } = await import(
      '@/modules/layanan/infrastructure/layanan.repository.impl'
    );
    const repo = new LayananRepositoryImpl(db);
    queryCount = 0;
    const items = await repo.listPublic({ regionRef: KEC_ID });
    expect(items).toHaveLength(4);
    expect(items[0]?.regionName).toBe('Kecamatan Layanan');
    expect(queryCount).toBe(1);
  });
});
