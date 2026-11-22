import type { LeaderboardEntry } from '../domain/entities/leaderboard-entry.entity';
import type { UserXpSnapshotPort } from '../application/ports/user-xp-snapshot.port';
import type { PublicUserRepository } from '@/modules/user/domain/repositories/public-user.repository';

/**
 * Snapshot XP leveling per user saat finalize leaderboard.
 * Memakai loadStats (derived) untuk membekukan total poin leveling.
 * Budget subrequest: 1 query per user (batch cross-join) x TOP_N <= 30 user.
 */
export class UserXpSnapshotAdapter implements UserXpSnapshotPort {
  constructor(private readonly users: PublicUserRepository) {}

  async snapshot(
    entries: LeaderboardEntry[],
    weekId: string,
    _now: Date,
  ): Promise<
    Array<{
      userId: string;
      weekId: string;
      submittedPoints: number;
      approvedPoints: number;
      verificationPoints: number;
      combined: number;
      xpAtWeekEnd: number;
    }>
  > {
    const rows: Array<{
      userId: string;
      weekId: string;
      submittedPoints: number;
      approvedPoints: number;
      verificationPoints: number;
      combined: number;
      xpAtWeekEnd: number;
    }> = [];
    for (const entry of entries) {
      try {
        const stats = await this.users.loadStats(entry.userId);
        rows.push({
          userId: entry.userId,
          weekId,
          submittedPoints: entry.submittedPoints,
          approvedPoints: entry.approvedPoints,
          verificationPoints: entry.verificationPoints,
          combined: entry.combined,
          xpAtWeekEnd: stats.leveling.points,
        });
      } catch (err) {
        // Satu user gagal tidak boleh membekukan snapshot sisanya.
        console.error(
          JSON.stringify({
            level: 'error',
            msg: 'user xp snapshot loadStats failed',
            weekId,
            userId: entry.userId,
            err: err instanceof Error ? err.message : String(err),
          }),
        );
      }
    }
    return rows;
  }
}
