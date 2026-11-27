import { describe, expect, it, vi } from 'vitest';
import { ForbiddenError } from '@/shared/errors/app-error';
import type { LeaderboardEntry } from '../../domain/entities/leaderboard-entry.entity';
import {
  leaderboardRankShareCopy,
  ShareLeaderboardRankUseCase,
} from '../../application/use-cases/share-leaderboard-rank.use-case';

function entry(rank: number, userId: string, combined = 10): LeaderboardEntry {
  return {
    rank,
    userId,
    username: `u${rank}`,
    displayName: null,
    avatarUrl: null,
    submittedPoints: combined,
    approvedPoints: 0,
    verificationPoints: 0,
    combined,
    isVerifier: false,
  };
}

function setup(entries: LeaderboardEntry[]) {
  const computeLive = {
    execute: vi.fn().mockResolvedValue({
      weekId: '2026-W48',
      startedAt: new Date(),
      endedAt: new Date(),
      entries,
      publishedUrl: null,
    }),
  };
  const eventRepo = { append: vi.fn().mockResolvedValue('appended' as const) };
  const useCase = new ShareLeaderboardRankUseCase(computeLive, eventRepo);
  return { useCase, computeLive, eventRepo };
}

const ranks = Array.from({ length: 30 }, (_, i) => entry(i + 1, `user-${i + 1}`));

describe('ShareLeaderboardRankUseCase', () => {
  it('peringkat 1 lolos dan mencatat event dengan payload beku', async () => {
    const { useCase, eventRepo, computeLive } = setup([entry(1, 'user-1', 2248)]);
    const result = await useCase.execute('user-1');

    expect(result).toEqual({ rank: 1, combined: 2248, weekId: '2026-W48' });
    expect(computeLive.execute).toHaveBeenCalledWith(expect.any(Date), { publish: false });
    expect(eventRepo.append).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: 'leaderboard_rank_shared',
        actorId: 'user-1',
        targetId: '2026-W48',
        dedupeKey: 'leaderboard_share:user-1:2026-W48',
        payload: 'Menempati peringkat #1 papan peringkat mingguan dengan 2.248 poin',
      }),
    );
  });

  it('peringkat 25 lolos', async () => {
    const { useCase } = setup(ranks);
    await expect(useCase.execute('user-25')).resolves.toMatchObject({ rank: 25 });
  });

  it('peringkat 26 ditolak tanpa mencatat event', async () => {
    const { useCase, eventRepo } = setup(ranks);
    await expect(useCase.execute('user-26')).rejects.toMatchObject({
      errorCode: 'LEADERBOARD_NOT_IN_TOP',
    });
    await expect(useCase.execute('user-26')).rejects.toBeInstanceOf(ForbiddenError);
    expect(eventRepo.append).not.toHaveBeenCalled();
  });

  it('user yang tidak ada di papan peringkat ditolak', async () => {
    const { useCase, eventRepo } = setup(ranks);
    await expect(useCase.execute('orang-lain')).rejects.toMatchObject({
      errorCode: 'LEADERBOARD_NOT_IN_TOP',
    });
    expect(eventRepo.append).not.toHaveBeenCalled();
  });

  it('share ulang memakai dedupe key yang sama dengan peringkat terbaru', async () => {
    const first = setup([entry(5, 'user-x', 40)]);
    await first.useCase.execute('user-x');
    const second = setup([entry(2, 'user-x', 90)]);
    await second.useCase.execute('user-x');

    const a = first.eventRepo.append.mock.calls[0]![0];
    const b = second.eventRepo.append.mock.calls[0]![0];
    expect(a.dedupeKey).toBe(b.dedupeKey);
    expect(b.payload).toBe(leaderboardRankShareCopy(2, 90));
  });

  it('copy memakai pemisah ribuan', () => {
    expect(leaderboardRankShareCopy(3, 1234567)).toBe(
      'Menempati peringkat #3 papan peringkat mingguan dengan 1.234.567 poin',
    );
  });
});
