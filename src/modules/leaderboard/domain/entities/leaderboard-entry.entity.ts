export interface LeaderboardEntry {
  rank: number;
  userId: string;
  username: string;
  avatarUrl: string | null;
  contributions: number;
  verifications: number;
  combined: number;
  isVerifier: boolean;
}

/** Bentuk file statis di repo CDN (bukan envelope API). */
export interface LeaderboardFilePayload {
  week_id: string;
  starts_at: string;
  ends_at: string;
  finalized: boolean;
  generated_at: string;
  entries: Array<{
    rank: number;
    username: string;
    avatar_url: string | null;
    contributions: number;
    verifications: number;
    combined: number;
    is_verifier: boolean;
  }>;
}

export interface LeaderboardWeekRecord {
  id: string;
  weekId: string;
  startedAt: Date;
  endedAt: Date;
  finalizedAt: Date | null;
  publishedUrl: string | null;
  updatedAt: Date | null;
}