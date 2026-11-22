import type { LeaderboardEntry } from '../../domain/entities/leaderboard-entry.entity';

/**
 * Port untuk snapshot XP leveling saat finalize leaderboard mingguan.
 * Tujuannya membekukan total XP per user pada akhir minggu tersebut agar
 * pergerakan XP (riwayat poin + level) dapat dibaca ke depan tanpa query ulang.
 */
export interface UserXpSnapshotPort {
  /**
   * Hitung total XP leveling untuk tiap entry di jendela minggu yang baru
   * difinalisasi, lalu kembalikan baris-ready untuk disimpan ke user_week_stats.
   *
   * @param entries  entri papan peringkat minggu ini (sudah dihitung dari window).
   * @param weekId   ID minggu yang sedang difinalisasi.
   * @param now      timestamp saat finalize berjalan.
   */
  snapshot(
    entries: LeaderboardEntry[],
    weekId: string,
    now: Date,
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
  >;
}
