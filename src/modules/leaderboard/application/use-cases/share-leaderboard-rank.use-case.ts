import { ForbiddenError } from '@/shared/errors/app-error';
import type { ActivityEventRepository } from '@/modules/activity/domain/repositories/activity-event.repository';
import { LEADERBOARD_SHARE_MAX_RANK } from '../../domain/utils/iso-week';
import type { ComputeLiveLeaderboardUseCase } from './compute-live-leaderboard.use-case';

export interface ShareLeaderboardRankResult {
  rank: number;
  combined: number;
  weekId: string;
}

/** `2248` -> `2.248` (pemisah ribuan Indonesia, tanpa bergantung ICU runtime). */
function formatRibuan(value: number): string {
  return String(value).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

/** Copy feed beku saat share; beranda dan profil membaca payload yang sama. */
export function leaderboardRankShareCopy(rank: number, combined: number): string {
  return `Menempati peringkat #${rank} papan peringkat mingguan dengan ${formatRibuan(combined)} poin`;
}

/**
 * Bagikan posisi papan peringkat minggu berjalan ke feed.
 * Posisi dicari dari userId token (bukan input klien) supaya tidak bisa
 * mengaku posisi orang lain. Satu event per user per minggu; share ulang
 * menimpa payload dengan peringkat terbaru.
 */
export class ShareLeaderboardRankUseCase {
  constructor(
    private readonly computeLive: Pick<ComputeLiveLeaderboardUseCase, 'execute'>,
    private readonly eventRepo: Pick<ActivityEventRepository, 'append'>,
  ) {}

  async execute(userId: string, now: Date = new Date()): Promise<ShareLeaderboardRankResult> {
    const live = await this.computeLive.execute(now, { publish: false });
    const entry = live.entries.find((e) => e.userId === userId);
    if (!entry || entry.rank < 1 || entry.rank > LEADERBOARD_SHARE_MAX_RANK) {
      throw new ForbiddenError(
        'LEADERBOARD_NOT_IN_TOP',
        `Posisi kamu belum masuk peringkat 1-${LEADERBOARD_SHARE_MAX_RANK} minggu ini`,
      );
    }

    await this.eventRepo.append({
      kind: 'leaderboard_rank_shared',
      actorId: userId,
      targetId: live.weekId,
      occurredAt: now,
      dedupeKey: `leaderboard_share:${userId}:${live.weekId}`,
      payload: leaderboardRankShareCopy(entry.rank, entry.combined),
    });

    return { rank: entry.rank, combined: entry.combined, weekId: live.weekId };
  }
}
