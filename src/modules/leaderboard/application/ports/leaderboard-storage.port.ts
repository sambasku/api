import type { LeaderboardFilePayload } from '../../domain/entities/leaderboard-entry.entity';

export interface LeaderboardPublishResult {
  url: string | null;
}

export interface LeaderboardStoragePort {
  /** URL publik `current.json` (raw GitHub), null jika storage nonaktif. */
  readonly currentPublicUrl: string | null;

  /** URL pola weekly di CDN, null jika repo belum dikonfigurasi. */
  weeklyPublicUrl(weekId: string): string | null;

  publishCurrent(payload: LeaderboardFilePayload): Promise<LeaderboardPublishResult>;

  publishWeekly(weekId: string, payload: LeaderboardFilePayload): Promise<LeaderboardPublishResult>;
}