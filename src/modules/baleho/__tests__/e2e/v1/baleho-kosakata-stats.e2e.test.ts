import { describe, it, expect, beforeAll } from 'vitest';
import { config } from 'dotenv';

const { parsed } = config({ path: '.env.test', quiet: true });
const hasTestDb = !!parsed?.DATABASE_URL;
if (parsed?.DATABASE_URL) process.env.DATABASE_URL = parsed.DATABASE_URL;

const ulid26 = (prefix: string) => prefix.padEnd(26, '0').slice(0, 26);
const LANG = ulid26('01KOSAKATALANG');

describe.skipIf(!hasTestDb)('GET /api/v1/baleho/kosakata-stats', () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let app: any;

  beforeAll(async () => {
    const { getTestDb } = await import('@/shared/database/drizzle/test-client');
    const { languages, words } = await import('@/shared/database/drizzle/schema');
    const { truncateAll } = await import('@/shared/database/drizzle/test-utils');
    const db = getTestDb();
    await truncateAll(db);
    await db.insert(languages).values({ id: LANG, code: 'smb', name: 'Sambas' });
    await db.insert(words).values([
      {
        id: ulid26('01KOSAKATAPUBV'),
        languageId: LANG,
        lemma: 'terbit-verifikasi',
        status: 'published',
        isVerified: true,
      },
      {
        id: ulid26('01KOSAKATAPUBU'),
        languageId: LANG,
        lemma: 'terbit-belum',
        status: 'published',
        isVerified: false,
      },
      {
        id: ulid26('01KOSAKATAQUEUE'),
        languageId: LANG,
        lemma: 'antre',
        status: 'pending_review',
        isVerified: false,
      },
      {
        id: ulid26('01KOSAKATAREJEC'),
        languageId: LANG,
        lemma: 'tolak',
        status: 'rejected',
        isVerified: false,
      },
      {
        id: ulid26('01KOSAKATADRAFT'),
        languageId: LANG,
        lemma: 'draf',
        status: 'draft',
        isVerified: false,
      },
      {
        id: ulid26('01KOSAKATADELVD'),
        languageId: LANG,
        lemma: 'hapus',
        status: 'published',
        isVerified: true,
        deletedAt: new Date(),
      },
    ]);

    const appModule = await import('@/app');
    app = appModule.app;
  });

  it('hitung total, diverifikasi, antrian, ditolak tanpa draft dan yang dihapus', async () => {
    const res = await app.request('/api/v1/baleho/kosakata-stats');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({
      success: true,
      data: { total: 4, verified: 1, queue: 1, rejected: 1 },
    });
  });
});
