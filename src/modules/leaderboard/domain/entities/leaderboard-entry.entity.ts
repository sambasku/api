export interface LeaderboardEntry {
  rank: number;
  userId: string;
  username: string;
  displayName: string | null;
  avatarUrl: string | null;
  submittedPoints: number;
  approvedPoints: number;
  verificationPoints: number;
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
    display_name: string | null;
    avatar_url: string | null;
    submitted_points: number;
    approved_points: number;
    verification_points: number;
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