import { describe, it, expect, beforeAll } from 'vitest';
import { config } from 'dotenv';

const { parsed } = config({ path: '.env.test', quiet: true });
const hasTestDb = !!parsed?.DATABASE_URL;
if (parsed?.DATABASE_URL) process.env.DATABASE_URL = parsed.DATABASE_URL;

describe.skipIf(!hasTestDb)('Kreator query budget', () => {
  beforeAll(async () => {
    const { getTestDb } = await import('@/shared/database/drizzle/test-client');
    const { kreators, karyas, karyaCredits } = await import(
      '@/shared/database/drizzle/schema'
    );
    const db = getTestDb();
    const now = new Date();
    await db
      .insert(kreators)
      .values({
        id: '01EVKREATORBUDGET00000001',
        slug: 'kreator-budget-test',
        displayName: 'Kreator Budget',
        kind: 'person',
        linksJson: '[]',
        createdAt: now,
        updatedAt: now,
      })
      .onConflictDoNothing();
    await db
      .insert(karyas)
      .values({
        id: '01EVKARYAKREATORBDGT0001',
        slug: 'lagu-budget-kreator',
        title: 'Lagu Budget Kreator',
        kind: 'music',
        year: 2024,
        sambasConnectionsJson: JSON.stringify([{ type: 'theme', note: 'Sambas' }]),
        accessLinksJson: '[]',
        sourcesJson: '[]',
        relatedJson: '[]',
        publishStatus: 'published',
        musicIsCover: false,
        publishedAt: now,
        createdAt: now,
        updatedAt: now,
      })
      .onConflictDoNothing();
    await db
      .insert(karyaCredits)
      .values({
        id: '01EVKCREDKREATORBDGT00001',
        karyaId: '01EVKARYAKREATORBDGT0001',
        kreatorId: '01EVKREATORBUDGET00000001',
        role: 'vocal',
        nameText: 'Kreator Budget',
        sortOrder: 0,
        createdAt: now,
      })
      .onConflictDoNothing();
  });

  it('GET kreator/:slug path = maksimal 3 query', async () => {
    const { createClient } = await import('@libsql/client');
    const { drizzle } = await import('drizzle-orm/libsql');
    const schema = await import('@/shared/database/drizzle/schema');
    const { KreatorRepositoryImpl } = await import(
      '../../infrastructure/kreator.repository.impl'
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
    const repo = new KreatorRepositoryImpl(drizzle(client, { schema }));
    const kreator = await repo.findKreatorBySlug('kreator-budget-test');
    expect(kreator).not.toBeNull();
    const karyas = await repo.listPublishedKaryaByKreatorId(kreator!.id);
    expect(karyas.length).toBeGreaterThanOrEqual(1);
    expect(queryCount).toBeLessThanOrEqual(3);
  });
});