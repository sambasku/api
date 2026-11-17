import type {
  LeaderboardEntry,
  LeaderboardWeekRecord,
} from '../entities/leaderboard-entry.entity';

export type LeaderboardMetric = 'combined' | 'contributions' | 'verifications';

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

  findWeekByWeekId(weekId: string): Promise<LeaderboardWeekRecord | null>;

  /** Minggu sudah lewat (`ended_at <= now`) tapi `finalized_at` masih null. */
  listUnfinalizedWeeksDue(now: Date): Promise<LeaderboardWeekRecord[]>;

  touchWeekUpdatedAt(weekId: string, at: Date): Promise<void>;
}