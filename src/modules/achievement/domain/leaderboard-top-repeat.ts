import type { AchievementCriteria } from './entities/achievement.entity';

/** Hitung berapa kali rank masuk rentang criteria `leaderboard_top`. */
export function countLeaderboardTopRepeats(
  ranks: Array<{ rank: number; weekStartedAt: Date }>,
  criteria: AchievementCriteria,
): number {
  if (criteria.source !== 'leaderboard_top') return 0;
  const minRaw = criteria.filters?.rank_min;
  const maxRaw = criteria.filters?.rank_max;
  const rankMin = minRaw != null ? Number(minRaw) : NaN;
  const rankMax = maxRaw != null ? Number(maxRaw) : NaN;
  if (!Number.isFinite(rankMin) || !Number.isFinite(rankMax) || rankMin < 1 || rankMax < rankMin) {
    return 0;
  }
  const from = criteria.window?.from ? new Date(criteria.window.from) : null;
  const to = criteria.window?.to ? new Date(criteria.window.to) : null;
  let n = 0;
  for (const row of ranks) {
    if (row.rank < rankMin || row.rank > rankMax) continue;
    if (from && row.weekStartedAt < from) continue;
    if (to && !(row.weekStartedAt < to)) continue;
    n += 1;
  }
  return n;
}
