import type {
  LeaderboardEntry,
  LeaderboardWeekRecord,
} from '../entities/leaderboard-entry.entity';

export type LeaderboardMetric = 'combined' | 'submitted' | 'approved' | 'verifications';

export interface LeaderboardExclusionRow {
  userId: string;
  username: string;
  displayName: string | null;
  note: string | null;
  createdAt: Date;
  isDefaultSystem: boolean;
}

export interface UpsertLeaderboardWeekInput {
  weekId: string;
  startedAt: Date;
  endedAt: Date;
  finalizedAt?: Date | null;
  publishedUrl?: string | null;
  updatedAt?: Date | null;
}

export interface LeaderboardRepository {
  /** Skor live untuk window [startedAt, endedAt), top {@link TOP_N} by combined. */
  computeScoresForWindow(startedAt: Date, endedAt: Date): Promise<LeaderboardEntry[]>;

  computeAllTime(metric: LeaderboardMetric, limit: number): Promise<LeaderboardEntry[]>;

  upsertWeek(input: UpsertLeaderboardWeekInput): Promise<LeaderboardWeekRecord>;

  replaceEntriesForWeek(weekId: string, entries: LeaderboardEntry[]): Promise<void>;

  listEntriesForWeek(weekId: string): Promise<LeaderboardEntry[]>;

  /** Snapshot minggu tanpa user yang saat ini di-exclude; rank dinomori ulang 1..n. */
  listVisibleEntriesForWeek(weekId: string): Promise<LeaderboardEntry[]>;

  findWeekByWeekId(weekId: string): Promise<LeaderboardWeekRecord | null>;

  findWeeksByWeekIds(weekIds: string[]): Promise<LeaderboardWeekRecord[]>;

  /** Minggu sudah lewat (`ended_at <= now`) tapi `finalized_at` masih null. */
  listUnfinalizedWeeksDue(now: Date): Promise<LeaderboardWeekRecord[]>;

  /**
   * Entri minggu yang sudah finalized tapi belum punya baris `user_week_stats`
   * (untuk backfill XP bertahap di cron).
   */
  listEntriesMissingWeekStats(
    fromWeekId: string,
    limit: number,
  ): Promise<Array<{ weekId: string; entry: LeaderboardEntry }>>;

  touchWeekUpdatedAt(weekId: string, at: Date): Promise<void>;

  listExcludedUserIds(): Promise<string[]>;

  listExcludedUsers(): Promise<LeaderboardExclusionRow[]>;

  /** Semua user sistem bawaan + status excluded saat ini (untuk panel admin). */
  listSystemUsers(): Promise<LeaderboardExclusionRow[]>;

  addExclusion(userId: string, note?: string | null): Promise<void>;

  removeExclusion(userId: string): Promise<boolean>;

  /** User aktif (belum soft-delete) untuk validasi POST exclude. */
  findUserForExclusion(userId: string): Promise<{ id: string } | null>;
/**
 * Simpan snapshot poin mingguan user (idempoten per user+minggu):
 * skor 5/3/2/2 + total XP leveling saat minggu berakhir.
 */
saveUserWeekStats(
  rows: Array<{
    userId: string;
    weekId: string;
    submittedPoints: number;
    approvedPoints: number;
    verificationPoints: number;
    combined: number;
    xpAtWeekEnd: number;
  }>,
): Promise<void>;
/** Riwayat mingguan user, minggu terbaru dulu. */
listUserWeekStats(
  userId: string,
  limit: number,
): Promise<
  Array<{
    weekId: string;
    submittedPoints: number;
    approvedPoints: number;
    verificationPoints: number;
    combined: number;
    xpAtWeekEnd: number;
  }>
>;
}