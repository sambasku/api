import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { config } from 'dotenv';

const { parsed } = config({ path: '.env.test', quiet: true });
const hasTestDb = !!parsed?.DATABASE_URL;
if (parsed?.DATABASE_URL) process.env.DATABASE_URL = parsed?.DATABASE_URL;

/**
 * Budget subrequest (AGENTS.md #26): satu request feed pantun tidak boleh
 * meledak query per baris. List = 1 query; detail = 2 query (opening + replies).
 */
describe.skipIf(!hasTestDb)('Pantun query budget', () => {
  let queryCount = 0;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let db: any;

  beforeAll(async () => {
    const { getTestDb } = await import('@/shared/database/drizzle/test-client');
    const schema = await import('@/shared/database/drizzle/schema');
    const { pantuns, pantunReplies, users } = schema;
    const { truncateAll } = await import('@/shared/database/drizzle/test-utils');
    const seedDb = getTestDb();

    await truncateAll(seedDb);
    await seedDb.insert(users).values({
      id: 'u_pqc1',
      username: 'pqcuser',
      displayName: 'PQ User',
      email: 'pqc@test.com',
      passwordHash: 'bukan-hash-login',
    });
    const lines = ['Pergi berjalan ke Sambas', 'Membeli ikan di pasar', 'Pulang bawa rumbas', 'Hatiku girang bersinar'];
    await seedDb.insert(pantuns).values(
      Array.from({ length: 25 }, (_, i) => ({
        id: `01PQC${String(i).padStart(21, '0')}`,
        userId: 'u_pqc1',
        language: 'id',
        rhymeScheme: 'ABAB' as const,
        lines,
        status: 'published' as const,
        createdAt: new Date(Date.now() - i * 1000),
      })),
);
await seedDb.insert(pantunReplies).values(
  Array.from({ length: 5 }, (_, i) => ({
    id: `01PQCR${String(i).padStart(20, '0')}`,
    parentId: `01PQC${String(0).padStart(21, '0')}`,
    userId: 'u_pqc1',
    language: 'id',
    rhymeScheme: 'ABAB' as const,
    lines,
    status: 'published' as const,
        createdAt: new Date(Date.now() - i * 1000),
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

  it('list feed pakai <= 1 query per halaman (25 baris)', async () => {
    const { PantunRepositoryImpl } = await import(
      '@/modules/pantun/infrastructure/pantun.repository.impl'
    );
    queryCount = 0;
    const repo = new PantunRepositoryImpl(db);
    const page = await repo.list({ limit: 25, status: 'published' });
    expect(page.items.length).toBe(25);
    expect(queryCount).toBeLessThanOrEqual(1);
  });

  it('detail + balasan pakai <= 2 query', async () => {
    const { PantunRepositoryImpl } = await import(
      '@/modules/pantun/infrastructure/pantun.repository.impl'
    );
    queryCount = 0;
    const repo = new PantunRepositoryImpl(db);
    const pantun = await repo.findById(`01PQC${String(0).padStart(21, '0')}`);
    const replies = await repo.listReplies(`01PQC${String(0).padStart(21, '0')}`);
    expect(pantun).not.toBeNull();
    expect(replies.length).toBe(5);
    expect(queryCount).toBeLessThanOrEqual(2);
  });
});
