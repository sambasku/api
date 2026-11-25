import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  LEADERBOARD_XP_SNAPSHOT_FROM_WEEK,
  RunDueLeaderboardJobsUseCase,
} from '../../application/use-cases/run-due-leaderboard-jobs.use-case';
import type { LeaderboardRepository } from '../../domain/repositories/leaderboard.repository';
import type { FinalizeLeaderboardWeekUseCase } from '../../application/use-cases/finalize-leaderboard-week.use-case';
import type { ComputeLiveLeaderboardUseCase } from '../../application/use-cases/compute-live-leaderboard.use-case';
import type { UserXpSnapshotPort } from '../../application/ports/user-xp-snapshot.port';

function repoStub(overrides: Partial<LeaderboardRepository> = {}): LeaderboardRepository {
  return {
    listUnfinalizedWeeksDue: vi.fn().mockResolvedValue([]),
    findWeeksByWeekIds: vi.fn().mockImplementation((weekIds: string[]) =>
      Promise.resolve(
        weekIds.map((weekId) => ({
          weekId,
          startedAt: new Date(),
          endedAt: new Date(),
          finalizedAt: new Date(),
          publishedUrl: null,
          updatedAt: new Date(),
        })),
      ),
    ),
    findWeekByWeekId: vi.fn().mockResolvedValue({ weekId: '2026-W48', updatedAt: new Date() }),
    listEntriesMissingWeekStats: vi.fn().mockResolvedValue([]),
    saveUserWeekStats: vi.fn().mockResolvedValue(undefined),
    computeScoresForWindow: vi.fn(),
    computeAllTime: vi.fn(),
    upsertWeek: vi.fn(),
    replaceEntriesForWeek: vi.fn(),
    listEntriesForWeek: vi.fn(),
    listVisibleEntriesForWeek: vi.fn(),
    touchWeekUpdatedAt: vi.fn(),
    listExcludedUserIds: vi.fn(),
    listExcludedUsers: vi.fn(),
    listSystemUsers: vi.fn(),
    addExclusion: vi.fn(),
    removeExclusion: vi.fn(),
    findUserForExclusion: vi.fn(),
    listUserWeekStats: vi.fn(),
    ...overrides,
  } as unknown as LeaderboardRepository;
}

describe('RunDueLeaderboardJobsUseCase', () => {
  const finalize = { execute: vi.fn().mockResolvedValue({}) } as unknown as FinalizeLeaderboardWeekUseCase;
  const computeLive = { execute: vi.fn().mockResolvedValue({}) } as unknown as ComputeLiveLeaderboardUseCase;
  const xpSnapshot = {
    snapshot: vi.fn().mockResolvedValue([]),
  } as unknown as UserXpSnapshotPort;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('tidak menjalankan snapshot XP saat ada minggu yang di-finalize', async () => {
    const repo = repoStub({
      listUnfinalizedWeeksDue: vi.fn().mockResolvedValue([{ weekId: '2026-W47' }]),
    });
    const job = new RunDueLeaderboardJobsUseCase(repo, finalize, computeLive, xpSnapshot);

    await job.execute(new Date('2026-11-25T12:00:00+07:00'));

    expect(finalize.execute).toHaveBeenCalledWith('2026-W47', expect.any(Date));
    expect(repo.listEntriesMissingWeekStats).not.toHaveBeenCalled();
    expect(xpSnapshot.snapshot).not.toHaveBeenCalled();
  });

  it('snapshot XP chunk saat tidak ada finalize', async () => {
    const entry = {
      rank: 1,
      userId: '01USER000000000000000001',
      username: 'userone',
      displayName: null,
      avatarUrl: null,
      submittedPoints: 5,
      approvedPoints: 2,
      verificationPoints: 0,
      combined: 7,
      isVerifier: false,
    };
    const repo = repoStub({
      listEntriesMissingWeekStats: vi.fn().mockResolvedValue([{ weekId: '2026-W47', entry }]),
    });
    (xpSnapshot.snapshot as ReturnType<typeof vi.fn>).mockResolvedValue([
      {
        userId: entry.userId,
        weekId: '2026-W47',
        submittedPoints: 5,
        approvedPoints: 2,
        verificationPoints: 0,
        combined: 7,
        xpAtWeekEnd: 40,
      },
    ]);
    const job = new RunDueLeaderboardJobsUseCase(repo, finalize, computeLive, xpSnapshot);

    await job.execute(new Date('2026-11-25T12:00:00+07:00'));

    expect(repo.listEntriesMissingWeekStats).toHaveBeenCalledWith(
      LEADERBOARD_XP_SNAPSHOT_FROM_WEEK,
      20,
    );
    expect(xpSnapshot.snapshot).toHaveBeenCalledWith([entry], '2026-W47', expect.any(Date));
    expect(repo.saveUserWeekStats).toHaveBeenCalled();
  });

  it('collectDueWeekIds memakai findWeeksByWeekIds batch, bukan findWeekByWeekId per minggu', async () => {
    const repo = repoStub();
    const job = new RunDueLeaderboardJobsUseCase(repo, finalize, computeLive, xpSnapshot);

    await job.execute(new Date('2026-11-25T12:00:00+07:00'));

    expect(repo.findWeeksByWeekIds).toHaveBeenCalledTimes(1);
    const weekIds = (repo.findWeeksByWeekIds as ReturnType<typeof vi.fn>).mock.calls[0][0] as string[];
    expect(weekIds.length).toBeGreaterThan(0);
    expect(weekIds.length).toBeLessThanOrEqual(12);
    expect(repo.findWeekByWeekId).toHaveBeenCalledTimes(1);
  });
});