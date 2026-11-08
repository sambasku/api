import { describe, it, expect, beforeAll } from 'vitest';
import { config } from 'dotenv';

const { parsed } = config({ path: '.env.test', quiet: true });
const hasTestDb = !!parsed?.DATABASE_URL;
if (parsed?.DATABASE_URL) process.env.DATABASE_URL = parsed.DATABASE_URL;

describe.skipIf(!hasTestDb)('Layanan query budget', () => {
  const KEC = '01EVKECQBUDGETLAYANAN000001';

  beforeAll(async () => {
    const { getTestDb } = await import('@/shared/database/drizzle/test-client');
    const { layanans, regions } = await import('@/shared/database/drizzle/schema');
    const db = getTestDb();
    await db.insert(regions).values({
      id: KEC,
      slug: 'budget-layanan',
      name: 'Budget',
      type: 'kecamatan',
      status: 'published',
    }).onConflictDoNothing();
    await db.insert(layanans).values(
      ['ambulance', 'ambulance', 'fire', 'fire'].map((category, i) => ({
        id: `01EVLAYANANBUDGET00000000${i + 1}`,
        slug: `budget-layanan-${i + 1}`,
        category: category as 'ambulance' | 'fire',
        name: `Nomor ${i + 1}`,
        phonesJson: JSON.stringify([{ phone: `08123000000${i}`, note: null, whatsapp: null }]),
        regionId: KEC,
        publishStatus: 'published' as const,
        createdAt: new Date(),
        updatedAt: new Date(),
      })),
    ).onConflictDoNothing();
  });

  it('daftar publik 4 baris = 1 query dan nama kecamatan ikut', async () => {
    const { createClient } = await import('@libsql/client');
    const { drizzle } = await import('drizzle-orm/libsql');
    const schema = await import('@/shared/database/drizzle/schema');
    const { LayananRepositoryImpl } = await import('../../infrastructure/layanan.repository.impl');
    const client = createClient({ url: process.env.DATABASE_URL! });
    const realExecute = client.execute.bind(client);
    let queryCount = 0;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (client as any).execute = async (...args: unknown[]) => {
      queryCount++;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return (realExecute as any)(...args);
    };
    const repo = new LayananRepositoryImpl(drizzle(client, { schema }));
    const items = await repo.listPublic({ regionRef: KEC });
    expect(items).toHaveLength(4);
    expect(items[0]?.regionName).toBe('Budget');
    expect(queryCount).toBe(1);
  });
});
