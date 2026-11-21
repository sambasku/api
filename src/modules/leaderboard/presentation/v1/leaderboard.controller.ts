import type { Context } from 'hono';
import { env } from '@/shared/config/env';
import { ServiceUnavailableError } from '@/shared/errors/app-error';
import type { GetLeaderboardUseCase } from '../../application/use-cases/get-leaderboard.use-case';
import type { ComputeLiveLeaderboardUseCase } from '../../application/use-cases/compute-live-leaderboard.use-case';
import type { FinalizeLeaderboardWeekUseCase } from '../../application/use-cases/finalize-leaderboard-week.use-case';
import { serializeWireEntry } from '../../application/use-cases/leaderboard-payload.utils';
import type {
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
}