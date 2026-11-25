import {
  REFRESH_INTERVAL_MS,
  currentWeekWindow,
  weekId as weekIdFromDate,
  windowForWeekId,
} from '../../domain/utils/iso-week';
import type { LeaderboardRepository } from '../../domain/repositories/leaderboard.repository';
import type { FinalizeLeaderboardWeekUseCase } from './finalize-leaderboard-week.use-case';
import type { ComputeLiveLeaderboardUseCase } from './compute-live-leaderboard.use-case';
import type { UserXpSnapshotPort } from '../ports/user-xp-snapshot.port';
import type { LeaderboardEntry } from '../../domain/entities/leaderboard-entry.entity';

/** Minggu paling awal yang di-backfill XP bertahap (hindari XP "sekarang" untuk minggu lama). */
export const LEADERBOARD_XP_SNAPSHOT_FROM_WEEK = '2026-W47';

const XP_SNAPSHOT_CHUNK = 20;

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
    private readonly xpSnapshot?: UserXpSnapshotPort,
  ) {}

  async execute(now: Date = new Date()): Promise<RunDueLeaderboardJobsResult> {
    const weekIdsToFinalize = await this.collectDueWeekIds(now);
    for (const id of weekIdsToFinalize) {
      await this.finalizeWeek.execute(id, now);
    }

    if (weekIdsToFinalize.length === 0 && this.xpSnapshot) {
      try {
        await this.runXpSnapshotChunk(now);
      } catch (err) {
        console.error(
          JSON.stringify({
            level: 'error',
            msg: 'leaderboard xp snapshot chunk failed',
            err: err instanceof Error ? err.message : String(err),
          }),
        );
      }
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

  private async runXpSnapshotChunk(now: Date): Promise<void> {
    const pending = await this.repo.listEntriesMissingWeekStats(
      LEADERBOARD_XP_SNAPSHOT_FROM_WEEK,
      XP_SNAPSHOT_CHUNK,
    );
    if (pending.length === 0) return;

    const byWeek = new Map<string, LeaderboardEntry[]>();
    for (const row of pending) {
      const bucket = byWeek.get(row.weekId) ?? [];
      bucket.push(row.entry);
      byWeek.set(row.weekId, bucket);
    }

    for (const [weekId, entries] of byWeek) {
      const rows = await this.xpSnapshot!.snapshot(entries, weekId, now);
      if (rows.length > 0) {
        await this.repo.saveUserWeekStats(rows);
      }
    }
  }

  private async collectDueWeekIds(now: Date): Promise<string[]> {
    const ids = new Set<string>();
    for (const row of await this.repo.listUnfinalizedWeeksDue(now)) {
      ids.add(row.weekId);
    }
    const { startedAt } = currentWeekWindow(now);
    let cursor = new Date(startedAt.getTime() - 1);
    const candidateIds: string[] = [];
    for (let i = 0; i < 12; i++) {
      const wid = weekIdFromDate(cursor);
      const { endedAt } = windowForWeekId(wid);
      if (endedAt > now) break;
      candidateIds.push(wid);
      const { startedAt: ws } = windowForWeekId(wid);
      cursor = new Date(ws.getTime() - 1);
    }
    if (candidateIds.length > 0) {
      const rows = await this.repo.findWeeksByWeekIds(candidateIds);
      const byId = new Map(rows.map((r) => [r.weekId, r]));
      for (const wid of candidateIds) {
        const row = byId.get(wid);
        if (!row?.finalizedAt) ids.add(wid);
      }
    }
    return [...ids].sort();
  }
}