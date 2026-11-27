import type { Context } from 'hono';
import { env } from '@/shared/config/env';
import { ServiceUnavailableError } from '@/shared/errors/app-error';
import type { GetLeaderboardUseCase } from '../../application/use-cases/get-leaderboard.use-case';
import type { ComputeLiveLeaderboardUseCase } from '../../application/use-cases/compute-live-leaderboard.use-case';
import type { FinalizeLeaderboardWeekUseCase } from '../../application/use-cases/finalize-leaderboard-week.use-case';
import type { GetPointsHistoryUseCase } from '../../application/use-cases/get-points-history.use-case';
import type { ShareLeaderboardRankUseCase } from '../../application/use-cases/share-leaderboard-rank.use-case';
import type { ManageLeaderboardExclusionsUseCase } from '../../application/use-cases/manage-leaderboard-exclusions.use-case';
import { serializeWireEntry } from '../../application/use-cases/leaderboard-payload.utils';
import type { AppVariables } from '@/shared/types';
import type {
  AddLeaderboardExclusionBody,
  FinalizeLeaderboardBody,
  GetLeaderboardQuery,
} from './validators/leaderboard.validator';

function assertStorageForAdminForce(): void {
  if (!env.LEADERBOARD_GITHUB_URL || !env.LEADERBOARD_GITHUB_TOKEN) {
    throw new ServiceUnavailableError(
      'LEADERBOARD_STORAGE_UNAVAILABLE',
      'Penyimpanan leaderboard belum dikonfigurasi - isi LEADERBOARD_GITHUB_* dulu',
    );
  }
}

export class LeaderboardController {
  constructor(
    private readonly deps: {
      getLeaderboard: GetLeaderboardUseCase;
      computeLive: ComputeLiveLeaderboardUseCase;
      finalizeWeek: FinalizeLeaderboardWeekUseCase;
      manageExclusions: ManageLeaderboardExclusionsUseCase;
      getPointsHistory: GetPointsHistoryUseCase;
      shareRank: ShareLeaderboardRankUseCase;
    },
  ) {}

  async getPublic(c: Context, query: GetLeaderboardQuery) {
    const result = await this.deps.getLeaderboard.execute({
      period: query.period,
      weekId: query.week_id,
      metric: query.metric,
      limit: query.limit,
    });
    c.header('Cache-Control', 'public, max-age=300');
    return c.json({
      success: true as const,
      data: result.entries.map(serializeWireEntry),
      meta: result.meta,
    });
  }

  async pointsHistory(c: Context, username: string, limit: number) {
    const result = await this.deps.getPointsHistory.execute({ username, limit });
    c.header('Cache-Control', 'public, max-age=300');
    return c.json({ success: true as const, ...result });
  }

  async shareMyRank(c: Context<{ Variables: AppVariables }>) {
    const result = await this.deps.shareRank.execute(c.get('user')!.user_id);
    return c.json({
      success: true as const,
      data: { rank: result.rank, combined: result.combined, week_id: result.weekId },
    });
  }

  async adminRefresh(c: Context) {
    assertStorageForAdminForce();
    const result = await this.deps.computeLive.execute(new Date(), { publish: true });
    return c.json({
      success: true as const,
      data: {
        week_id: result.weekId,
        entry_count: result.entries.length,
        refreshed: true,
        current_url: result.publishedUrl,
      },
    });
  }

  async adminFinalize(c: Context, body: FinalizeLeaderboardBody) {
    assertStorageForAdminForce();
    const result = await this.deps.finalizeWeek.execute(body.week_id);
    return c.json({
      success: true as const,
      data: {
        week_id: result.weekId,
        entry_count: result.entryCount,
        weekly_url: result.weeklyUrl,
        current_url: result.currentUrl,
      },
    });
  }

  async listSystemUsers(c: Context) {
    const rows = await this.deps.manageExclusions.listSystem();
    return c.json({
      success: true as const,
      data: rows.map((r) => ({
        user_id: r.userId,
        username: r.username,
        display_name: r.displayName,
        note: r.note,
        created_at: r.createdAt.toISOString(),
        is_default_system: r.isDefaultSystem,
      })),
    });
  }

  async listExclusions(c: Context) {
    const rows = await this.deps.manageExclusions.list();
    return c.json({
      success: true as const,
      data: rows.map((r) => ({
        user_id: r.userId,
        username: r.username,
        display_name: r.displayName,
        note: r.note,
        created_at: r.createdAt.toISOString(),
        is_default_system: r.isDefaultSystem,
      })),
    });
  }

  async addExclusion(c: Context<{ Variables: AppVariables }>, body: AddLeaderboardExclusionBody) {
    const actorId = c.get('user')!.user_id;
    const result = await this.deps.manageExclusions.add({
      userId: body.user_id,
      note: body.note,
      actorId,
    });
    return c.json({ success: true as const, data: result });
  }

  async removeExclusion(c: Context<{ Variables: AppVariables }>, userId: string) {
    const actor = c.get('user')!;
    const result = await this.deps.manageExclusions.remove({
      userId,
      actorId: actor.user_id,
      actorRoles: actor.roles,
    });
    return c.json({ success: true as const, data: result });
  }
}