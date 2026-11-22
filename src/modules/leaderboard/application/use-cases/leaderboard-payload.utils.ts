import type { LeaderboardEntry, LeaderboardFilePayload } from '../../domain/entities/leaderboard-entry.entity';
import { formatWibOffset } from '../../domain/utils/iso-week';

export function toFilePayload(input: {
  weekId: string;
  startedAt: Date;
  endedAt: Date;
  finalized: boolean;
  entries: LeaderboardEntry[];
  generatedAt?: Date;
}): LeaderboardFilePayload {
  const generatedAt = input.generatedAt ?? new Date();
  return {
    week_id: input.weekId,
    starts_at: formatWibOffset(input.startedAt),
    ends_at: formatWibOffset(input.endedAt),
    finalized: input.finalized,
    generated_at: generatedAt.toISOString(),
    entries: input.entries.map((e) => ({
      rank: e.rank,
      username: e.username,
      display_name: e.displayName,
      avatar_url: e.avatarUrl,
      submitted_points: e.submittedPoints,
      approved_points: e.approvedPoints,
      verification_points: e.verificationPoints,
      combined: e.combined,
      is_verifier: e.isVerifier,
    })),
  };
}

export function serializeWireEntry(e: LeaderboardEntry): Record<string, unknown> {
  return {
    rank: e.rank,
    username: e.username,
    display_name: e.displayName,
    avatar_url: e.avatarUrl,
    submitted_points: e.submittedPoints,
    approved_points: e.approvedPoints,
    verification_points: e.verificationPoints,
    combined: e.combined,
    is_verifier: e.isVerifier,
  };
}