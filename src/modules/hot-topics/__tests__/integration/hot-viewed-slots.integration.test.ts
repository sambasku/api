import { describe, it, expect, beforeEach } from 'vitest';
import { config } from 'dotenv';
import { searchDayWib } from '@/shared/database/drizzle/schema/search-daily.schema';
import { SyncHotViewedSlotsUseCase } from '../../application/sync-hot-viewed-slots.use-case';

const { parsed } = config({ path: '.env.test', quiet: true });
const hasTestDb = !!parsed?.DATABASE_URL;
if (parsed?.DATABASE_URL) process.env.DATABASE_URL = parsed.DATABASE_URL;

const MS_HOUR = 60 * 60 * 1000;

describe.skipIf(!hasTestDb)('HotTopics viewed slot expiry & cooldown (#372)', () => {
  const T0 = new Date('2026-11-27T08:00:00.000Z');
  const langId = '01HVS_LANG0000000000000001';
  const userId = '01HVS_USER0000000000000001';

  beforeEach(async () => {
    const { getTestDb } = await import('@/shared/database/drizzle/test-client');
    const schema = await import('@/shared/database/drizzle/schema');
    const { truncateAll } = await import('@/shared/database/drizzle/test-utils');
    const db = getTestDb();
    await truncateAll(db);

    await db.insert(schema.languages).values({
      id: langId,
      code: 'sbb',
      name: 'Sambas',
    });
    await db.insert(schema.users).values({
      id: userId,
      username: 'hvs_user',
      displayName: 'HVS User',
      email: 'hvs@test.com',
      passwordHash: 'hash',
    });

    // 3 kata: w_top paling banyak view (5), w_second (3), w_third (2)
    await db.insert(schema.words).values([
      {
        id: '01HVS_WORD0000000000000001',
        lemma: 'makatn',
        languageId: langId,
        status: 'published',
        isVerified: true,
        verifiedAt: T0,
        createdBy: userId,
        wordType: 'word',
      },
      {
        id: '01HVS_WORD0000000000000002',
        lemma: 'minum',
        languageId: langId,
        status: 'published',
        isVerified: true,
        verifiedAt: T0,
        createdBy: userId,
        wordType: 'word',
      },
      {
        id: '01HVS_WORD0000000000000003',
        lemma: 'tidok',
        languageId: langId,
        status: 'published',
        isVerified: true,
        verifiedAt: T0,
        createdBy: userId,
        wordType: 'word',
      },
    ]);

    const day = searchDayWib(T0);
    await db.insert(schema.wordViews).values([
      ...[1, 2, 3, 4, 5].map((n) => ({
        wordId: '01HVS_WORD0000000000000001',
        day,
        viewerKey: `u:v${n}`,
        count: 1,
      })),
      ...[1, 2, 3].map((n) => ({
        wordId: '01HVS_WORD0000000000000002',
        day,
        viewerKey: `u:v${n}`,
        count: 1,
      })),
      ...[1, 2].map((n) => ({
        wordId: '01HVS_WORD0000000000000003',
        day,
        viewerKey: `u:v${n}`,
        count: 1,
      })),
    ]);
  });

  it('bertahan < 24 jam, masuk cooldown di [24j, 48j) + fallback bila slot kurang, lalu aktif lagi >= 48 jam', async () => {
    const { getTestDb } = await import('@/shared/database/drizzle/test-client');
    const { HotTopicsRepositoryImpl } = await import(
      '../../infrastructure/hot-topics.repository.impl'
    );
    const db = getTestDb();
    const repo = new HotTopicsRepositoryImpl(db);
    const sync = new SyncHotViewedSlotsUseCase(repo);

    // T0: sync mencatat Top 10 (hanya 3 kata, tapi kita pakai slot manual untuk uji batas)
    // Catat hanya w_1 yang masuk Top 10 pada T0 (simulasi w_2 & w_3 baru naik belakangan)
    await repo.recordViewedSlotEntries(['01HVS_WORD0000000000000001'], {
      enteredAt: T0,
      expiresAt: new Date(T0.getTime() + 24 * MS_HOUR),
      cooldownUntil: new Date(T0.getTime() + 48 * MS_HOUR),
    });

    // T0 + 12 jam: w_1 masih aktif -> tetap peringkat 1
    const t12 = new Date(T0.getTime() + 12 * MS_HOUR);
    const at12 = await repo.listAllTabs(2, t12);
    expect(at12.viewed.items.slice(0, 2).map((i) => i.lemma)).toEqual(['makatn', 'minum']);

    // T0 + 25 jam: w_1 masuk cooldown -> w_2 & w_3 naik mengisi Top 2
    const t25 = new Date(T0.getTime() + 25 * MS_HOUR);
    const at25Limit2 = await repo.listAllTabs(2, t25);
    expect(at25Limit2.viewed.items.slice(0, 2).map((i) => i.lemma)).toEqual(['minum', 'tidok']);

    // Fallback: jika limit = 3 dan kandidat non-cooldown hanya 2, w_1 mengisi slot ke-3
    const at25Limit3 = await repo.listAllTabs(3, t25);
    expect(at25Limit3.viewed.items.slice(0, 3).map((i) => i.lemma)).toEqual([
      'minum',
      'tidok',
      'makatn',
    ]);

    // T0 + 49 jam: cooldown selesai -> cron prune & w_1 kembali ke peringkat 1
    const t49 = new Date(T0.getTime() + 49 * MS_HOUR);
    const syncRes = await sync.execute(t49, { force: true });
    expect(syncRes.pruned).toBe(1);
    expect(syncRes.recorded).toBeGreaterThanOrEqual(1);

    const at49 = await repo.listAllTabs(2, t49);
    expect(at49.viewed.items.slice(0, 2).map((i) => i.lemma)).toEqual(['makatn', 'minum']);
  });
});
