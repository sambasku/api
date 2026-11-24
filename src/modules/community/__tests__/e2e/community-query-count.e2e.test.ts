import { describe, it, expect, beforeAll } from 'vitest';
import { config } from 'dotenv';

const { parsed } = config({ path: '.env.test', quiet: true });
const hasTestDb = !!parsed?.DATABASE_URL;
if (parsed?.DATABASE_URL) process.env.DATABASE_URL = parsed.DATABASE_URL;

describe.skipIf(!hasTestDb)('Community query budget', () => {
  beforeAll(async () => {
    const { getTestDb } = await import('@/shared/database/drizzle/test-client');
    const { communityOrgs, kategoriKomunitas } = await import(
      '@/shared/database/drizzle/schema'
    );
    const db = getTestDb();
    await db
      .insert(kategoriKomunitas)
      .values({
        id: 'lain',
        name: 'Lainnya',
        status: 'published',
        sortOrder: 0,
        createdAt: new Date(),
      })
      .onConflictDoNothing();
    await db
      .insert(communityOrgs)
      .values(
        [1, 2, 3].map((i) => ({
          id: `01EVCOMMUNITYBUDGET000000${i}`,
          slug: `budget-community-${i}`,
          name: `Komunitas ${i}`,
          categoryId: 'lain',
          description: `Deskripsi ${i}`,
          status: 'published' as const,
          createdAt: new Date(Date.now() - i * 1000),
          updatedAt: new Date(),
        })),
      )
      .onConflictDoNothing();
  });

  it('list published = 1 query', async () => {
    const { createClient } = await import('@libsql/client');
    const { drizzle } = await import('drizzle-orm/libsql');
    const schema = await import('@/shared/database/drizzle/schema');
    const { CommunityRepositoryImpl } = await import(
      '../../infrastructure/community.repository.impl'
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
    const repo = new CommunityRepositoryImpl(drizzle(client, { schema }));
    const result = await repo.listPublished({ limit: 30 });
    expect(result.items.length).toBeGreaterThanOrEqual(3);
    expect(queryCount).toBeLessThanOrEqual(3);
    expect(queryCount).toBe(1);
  });
});
