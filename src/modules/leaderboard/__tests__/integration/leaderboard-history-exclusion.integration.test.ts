import { describe, it, expect, beforeEach } from 'vitest';
import { config } from 'dotenv';
import { getTestDb } from '@/shared/database/drizzle/test-client';
import { leaderboardExcludedUsers, leaderboardWeekEntries, users } from '@/shared/database/drizzle/schema';
import { truncateAll } from '@/shared/database/drizzle/test-utils';
import { LeaderboardRepositoryImpl } from '../../infrastructure/leaderboard.repository.impl';

const { parsed } = config({ path: '.env.test', quiet: true });
const hasTestDb = !!parsed?.DATABASE_URL;

const ulid26 = (prefix: string) => prefix.padEnd(26, '0').slice(0, 26);
const USER_A = ulid26('01TESTHISTA');
const USER_B = ulid26('01TESTHISTB');
const USER_C = ulid26('01TESTHISTC');
const WEEK_ID = '2026-W40';

describe.skipIf(!hasTestDb)('LeaderboardRepositoryImpl.listVisibleEntriesForWeek', () => {
  const db = hasTestDb ? getTestDb() : null!;
  const repo = hasTestDb ? new LeaderboardRepositoryImpl(db) : null!;

  beforeEach(async () => {
    await truncateAll(db);
    const seed = [
      { id: USER_A, username: 'useraaa', rank: 1, combined: 30 },
      { id: USER_B, username: 'userbbb', rank: 2, combined: 20 },
      { id: USER_C, username: 'userccc', rank: 3, combined: 10 },
    ];
    for (const u of seed) {
      await db.insert(users).values({
        id: u.id,
        username: u.username,
        email: `${u.username}@test.com`,
        passwordHash: 'x',
      });
    }
    await db.insert(leaderboardWeekEntries).values(
      seed.map((u) => ({
        weekId: WEEK_ID,
        userId: u.id,
        rank: u.rank,
        username: u.username,
        combined: u.combined,
      })),
    );
  });

  it('menyembunyikan user yang di-exclude dan menomori ulang rank', async () => {
    await db.insert(leaderboardExcludedUsers).values({ userId: USER_B });

    const entries = await repo.listVisibleEntriesForWeek(WEEK_ID);

    expect(entries.map((e) => [e.rank, e.username])).toEqual([
      [1, 'useraaa'],
      [2, 'userccc'],
    ]);
  });

  it('user muncul lagi setelah exclude dicabut', async () => {
    await db.insert(leaderboardExcludedUsers).values({ userId: USER_B });
    await repo.removeExclusion(USER_B);

    const entries = await repo.listVisibleEntriesForWeek(WEEK_ID);

    expect(entries.map((e) => [e.rank, e.username])).toEqual([
      [1, 'useraaa'],
      [2, 'userbbb'],
      [3, 'userccc'],
    ]);
  });

  it('listEntriesForWeek tetap mengembalikan snapshot utuh', async () => {
    await db.insert(leaderboardExcludedUsers).values({ userId: USER_B });

    const entries = await repo.listEntriesForWeek(WEEK_ID);

    expect(entries).toHaveLength(3);
  });
});
