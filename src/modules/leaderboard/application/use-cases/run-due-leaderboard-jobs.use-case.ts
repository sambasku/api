import { REFRESH_INTERVAL_MS, currentWeekWindow, weekId as weekIdFromDate, windowForWeekId } from '../../domain/utils/iso-week';
import type { LeaderboardRepository } from '../../domain/repositories/leaderboard.repository';
import type { FinalizeLeaderboardWeekUseCase } from './finalize-leaderboard-week.use-case';
import type { ComputeLiveLeaderboardUseCase } from './compute-live-leaderboard.use-case';

export interface RunDueLeaderboardJobsResult {
  refreshed: boolean;
  finalized: boolean;
  finalizedWeekIds: string[];
}

export class RunDueLeaderboardJobsUseCase {
  constructor(
    private readonly repo: LeaderboardRepository,
    private readonly finalizeWeek: FinalizeLeaderboardWeekUseCase,
    private readonly computeLive: ComputeLiveLeaderboardUseCase,
  ) {}

  async execute(now: Date = new Date()): Promise<RunDueLeaderboardJobsResult> {
    const weekIdsToFinalize = await this.collectDueWeekIds(now);
    for (const id of weekIdsToFinalize) {
      await this.finalizeWeek.execute(id, now);
    }

    const { weekId } = currentWeekWindow(now);
    const row = await this.repo.findWeekByWeekId(weekId);
    const stale =
      !row?.updatedAt || now.getTime() - row.updatedAt.getTime() >= REFRESH_INTERVAL_MS;

    let refreshed = false;
    if (stale) {
      await this.computeLive.execute(now, { publish: true });
      refreshed = true;
    }

    return {
      refreshed,
      finalized: weekIdsToFinalize.length > 0,
      finalizedWeekIds: weekIdsToFinalize,
    };
  }

  private async collectDueWeekIds(now: Date): Promise<string[]> {
    const ids = new Set<string>();
    for (const row of await this.repo.listUnfinalizedWeeksDue(now)) {
      ids.add(row.weekId);
    }
    const { startedAt } = currentWeekWindow(now);
    let cursor = new Date(startedAt.getTime() - 1);
    for (let i = 0; i < 12; i++) {
      const wid = weekIdFromDate(cursor);
      const { endedAt } = windowForWeekId(wid);
      if (endedAt > now) break;
      const row = await this.repo.findWeekByWeekId(wid);
      if (!row?.finalizedAt) ids.add(wid);
      const { startedAt: ws } = windowForWeekId(wid);
      cursor = new Date(ws.getTime() - 1);
    }
    return [...ids].sort();
  }
}