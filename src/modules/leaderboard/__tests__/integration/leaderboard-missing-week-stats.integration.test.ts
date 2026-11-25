import { describe, it, expect, beforeEach } from 'vitest';
import { config } from 'dotenv';
import { getTestDb } from '@/shared/database/drizzle/test-client';
import { leaderboardWeekEntries, leaderboardWeeks, users, userWeekStats } from '@/shared/database/drizzle/schema';
import { truncateAll } from '@/shared/database/drizzle/test-utils';
import { LeaderboardRepositoryImpl } from '../../infrastructure/leaderboard.repository.impl';
import { windowForWeekId } from '../../domain/utils/iso-week';

const { parsed } = config({ path: '.env.test', quiet: true });
const hasTestDb = !!parsed?.DATABASE_URL;

const ulid26 = (prefix: string) => prefix.padEnd(26, '0').slice(0, 26);
const USER_A = ulid26('01TESTMISSA');
const WEEK_ID = '2026-W47';

describe.skipIf(!hasTestDb)('LeaderboardRepositoryImpl.listEntriesMissingWeekStats', () => {
  const db = hasTestDb ? getTestDb() : null!;
  const repo = hasTestDb ? new LeaderboardRepositoryImpl(db) : null!;

  beforeEach(async () => {
    await truncateAll(db);
    const { startedAt, endedAt } = windowForWeekId(WEEK_ID);
    await db.insert(users).values({
      id: USER_A,
      username: 'userone',
      email: 'userone@test.com',
      passwordHash: 'x',
    });
    await db.insert(leaderboardWeeks).values({
      weekId: WEEK_ID,
      startedAt,
      endedAt,
      finalizedAt: new Date('2026-11-24T00:00:00Z'),
    });
    await db.insert(leaderboardWeekEntries).values({
      weekId: WEEK_ID,
      userId: USER_A,
      rank: 1,
      username: 'userone',
      combined: 7,
    });
  });

  it('mengembalikan entri finalized tanpa user_week_stats', async () => {
    const pending = await repo.listEntriesMissingWeekStats('2026-W47', 20);
    expect(pending).toHaveLength(1);
    expect(pending[0].weekId).toBe(WEEK_ID);
    expect(pending[0].entry.userId).toBe(USER_A);
  });

  it('kosong setelah stats tersimpan', async () => {
    await db.insert(userWeekStats).values({
      userId: USER_A,
      weekId: WEEK_ID,
      submittedPoints: 5,
      approvedPoints: 2,
      verificationPoints: 0,
      combined: 7,
      xpAtWeekEnd: 10,
    });
    const pending = await repo.listEntriesMissingWeekStats('2026-W47', 20);
    expect(pending).toHaveLength(0);
  });
});