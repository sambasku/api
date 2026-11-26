import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  RunDueLeaderboardJobsUseCase,
  XP_SNAPSHOT_LAST_RUN_KEY,
} from '../../application/use-cases/run-due-leaderboard-jobs.use-case';
import type { LeaderboardRepository } from '../../domain/repositories/leaderboard.repository';
import type { FinalizeLeaderboardWeekUseCase } from '../../application/use-cases/finalize-leaderboard-week.use-case';
import type { ComputeLiveLeaderboardUseCase } from '../../application/use-cases/compute-live-leaderboard.use-case';
import type { UserXpSnapshotPort } from '../../application/ports/user-xp-snapshot.port';
import type { AppSettingsRepository } from '@/modules/legal/domain/repositories/app-settings.repository';

const NOW = new Date('2026-11-25T12:00:00+07:00');
const ONE_MINUTE = 60 * 1000;
const SIX_HOURS = 6 * 60 * 60 * 1000;

const pendingEntry = {
  weekId: '2026-W47',
  entry: {
    rank: 1,
    userId: 'u_throttle1',
    username: 'throttle',
    displayName: null,
    avatarUrl: null,
    submittedPoints: 1,
    approvedPoints: 1,
    verificationPoints: 0,
    combined: 2,
    isVerifier: false,
  },
};

function repoStub(): LeaderboardRepository {
  return {
    listUnfinalizedWeeksDue: vi.fn().mockResolvedValue([]),
    findWeeksByWeekIds: vi.fn().mockImplementation((weekIds: string[]) =>
      Promise.resolve(
        weekIds.map((weekId) => ({
          weekId,
          startedAt: NOW,
          endedAt: NOW,
          finalizedAt: NOW,
          publishedUrl: null,
          updatedAt: NOW,
        })),
      ),
    ),
    findWeekByWeekId: vi.fn().mockResolvedValue({ weekId: '2026-W48', updatedAt: NOW }),
    listEntriesMissingWeekStats: vi.fn().mockResolvedValue([pendingEntry]),
    saveUserWeekStats: vi.fn().mockResolvedValue(undefined),
  } as unknown as LeaderboardRepository;
}

function settingsStub(lastRunIso: string | null): AppSettingsRepository {
  return {
    getValue: vi.fn().mockResolvedValue(lastRunIso),
    upsertMany: vi.fn().mockResolvedValue([]),
  } as unknown as AppSettingsRepository;
}

describe('RunDueLeaderboardJobsUseCase - throttle snapshot XP', () => {
  const finalize = { execute: vi.fn().mockResolvedValue({}) } as unknown as FinalizeLeaderboardWeekUseCase;
  const computeLive = { execute: vi.fn().mockResolvedValue({}) } as unknown as ComputeLiveLeaderboardUseCase;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('jalankan snapshot saat belum pernah dicoba dan catat waktu percobaan', async () => {
    const repo = repoStub();
    const settings = settingsStub(null);
    const xpSnapshot = { snapshot: vi.fn().mockResolvedValue([]) } as unknown as UserXpSnapshotPort;
    const job = new RunDueLeaderboardJobsUseCase(repo, finalize, computeLive, xpSnapshot, settings);

    await job.execute(NOW);

    expect(xpSnapshot.snapshot).toHaveBeenCalledTimes(1);
    expect(settings.upsertMany).toHaveBeenCalledWith(
      [expect.objectContaining({ key: XP_SNAPSHOT_LAST_RUN_KEY, value: NOW.toISOString() })],
      null,
    );
  });

  it('skip snapshot saat tick cron (1 menit) datang sebelum 6 jam', async () => {
    const repo = repoStub();
    const settings = settingsStub(new Date(NOW.getTime() - ONE_MINUTE).toISOString());
    const xpSnapshot = { snapshot: vi.fn().mockResolvedValue([]) } as unknown as UserXpSnapshotPort;
    const job = new RunDueLeaderboardJobsUseCase(repo, finalize, computeLive, xpSnapshot, settings);

    await job.execute(NOW);

    expect(xpSnapshot.snapshot).not.toHaveBeenCalled();
    expect(repo.listEntriesMissingWeekStats).not.toHaveBeenCalled();
    expect(settings.upsertMany).not.toHaveBeenCalled();
  });

  it('jalankan lagi setelah 6 jam', async () => {
    const repo = repoStub();
    const settings = settingsStub(new Date(NOW.getTime() - SIX_HOURS).toISOString());
    const xpSnapshot = { snapshot: vi.fn().mockResolvedValue([]) } as unknown as UserXpSnapshotPort;
    const job = new RunDueLeaderboardJobsUseCase(repo, finalize, computeLive, xpSnapshot, settings);

    await job.execute(NOW);

    expect(xpSnapshot.snapshot).toHaveBeenCalledTimes(1);
  });

  it('percobaan gagal tetap tercatat, jadi tick berikutnya tidak retry', async () => {
    const repo = repoStub();
    const settings = settingsStub(null);
    const xpSnapshot = {
      snapshot: vi.fn().mockRejectedValue(new Error('loadStats gagal')),
    } as unknown as UserXpSnapshotPort;
    const job = new RunDueLeaderboardJobsUseCase(repo, finalize, computeLive, xpSnapshot, settings);
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    await job.execute(NOW);
    expect(settings.upsertMany).toHaveBeenCalledTimes(1);

    // Tick berikutnya: marker sudah ada dan belum 6 jam, jadi tidak dicoba lagi.
    settings.getValue = vi.fn().mockResolvedValue(NOW.toISOString());
    await job.execute(new Date(NOW.getTime() + ONE_MINUTE));
    expect(xpSnapshot.snapshot).toHaveBeenCalledTimes(1);

    errorSpy.mockRestore();
  });
});
