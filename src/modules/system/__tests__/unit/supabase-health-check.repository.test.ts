import { describe, expect, it } from 'vitest';
import { createClient } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';
import { migrate } from 'drizzle-orm/libsql/migrator';
import * as schema from '@/shared/database/drizzle/schema';
import { SupabaseHealthCheckRepositoryImpl } from '../../infrastructure/supabase-health-check.repository.impl';

// Verifikasi perilaku inti list: filter env + cursor keyset, langsung ke file SQLite.
describe('SupabaseHealthCheckRepositoryImpl.list', () => {
  it('filter env + cursor keyset urut terbaru', async () => {
    const client = createClient({ url: ':memory:' });
    const db = drizzle(client, { schema });
    await migrate(db, { migrationsFolder: 'src/shared/database/drizzle/migrations' });

    const repo = new SupabaseHealthCheckRepositoryImpl(db);
    const now = new Date();
    await db.insert(schema.supabaseHealthChecks).values([
      { projectLabel: 'sambasku-staging', projectRef: 'wkhlcrxlncflcztptrmg', env: 'staging', status: 'ok', httpStatus: 200, createdAt: now, updatedAt: now },
      { projectLabel: 'sambasku-prod', projectRef: 'prodref000000000000000', env: 'production', status: 'ok', httpStatus: 200, createdAt: now, updatedAt: now },
      { projectLabel: 'sambasku-staging', projectRef: 'wkhlcrxlncflcztptrmg', env: 'staging', status: 'failed', httpStatus: 503, errorMessage: 'timeout', createdAt: now, updatedAt: now },
    ]);

    const staging = await repo.list({ limit: 10, env: 'staging' });
    expect(staging.items).toHaveLength(2);
    expect(staging.items.every((i) => i.env === 'staging')).toBe(true);

    const page1 = await repo.list({ limit: 2 });
    expect(page1.hasMore).toBe(true);
    expect(page1.nextCursor).toBe(page1.items[1].id);

    const page2 = await repo.list({ limit: 10, cursor: page1.nextCursor! });
    expect(page2.hasMore).toBe(false);
    expect(page2.items).toHaveLength(1);

    client.close();
  });
});
