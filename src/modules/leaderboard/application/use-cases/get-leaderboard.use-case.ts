import { NotFoundError } from '@/shared/errors/app-error';
import type { LeaderboardStoragePort } from '../ports/leaderboard-storage.port';
import type { LeaderboardMetric, LeaderboardRepository } from '../../domain/repositories/leaderboard.repository';
import type { LeaderboardEntry } from '../../domain/entities/leaderboard-entry.entity';
import {
  currentWeekWindow,
  formatWibOffset,
  parseWeekId,
  windowForWeekId,
} from '../../domain/utils/iso-week';
import type { ComputeLiveLeaderboardUseCase } from './compute-live-leaderboard.use-case';

export interface GetLeaderboardInput {
  period: 'week' | 'all';
  weekId?: string;
  metric: LeaderboardMetric;
  limit: number;
}

export interface GetLeaderboardResult {
  entries: LeaderboardEntry[];
  meta: {
    week_id: string | null;
    resets_at: string | null;
    metric: LeaderboardMetric;
    cdn: {
      current: string | null;
      weekly: string | null;
    };
  };
}

export class GetLeaderboardUseCase {
  constructor(
    private readonly repo: LeaderboardRepository,
    private readonly storage: LeaderboardStoragePort,
    private readonly computeLive: ComputeLiveLeaderboardUseCase,
  ) {}

  async execute(input: GetLeaderboardInput, now: Date = new Date()): Promise<GetLeaderboardResult> {
    if (input.period === 'all') {
      const entries = await this.repo.computeAllTime(input.metric, input.limit);
      return {
        entries,
        meta: {
          week_id: null,
          resets_at: null,
          metric: input.metric,
          cdn: {
            current: this.storage.currentPublicUrl,
            weekly: null,
          },
        },
      };
    }

    const live = currentWeekWindow(now);
    const targetWeekId = input.weekId ?? live.weekId;

    try {
      parseWeekId(targetWeekId);
    } catch {
      throw new NotFoundError('LEADERBOARD_WEEK_NOT_FOUND', 'Minggu leaderboard tidak valid');
    }

    const { startedAt, endedAt } = windowForWeekId(targetWeekId);
    if (startedAt > now) {
      throw new NotFoundError('LEADERBOARD_WEEK_NOT_FOUND', 'Minggu leaderboard belum dimulai');
    }

    let entries: LeaderboardEntry[];
    if (targetWeekId === live.weekId && !input.weekId) {
      const computed = await this.computeLive.execute(now, { publish: false });
      entries = computed.entries;
    } else {
      if (endedAt > now) {
        throw new NotFoundError('LEADERBOARD_WEEK_NOT_FOUND', 'Minggu leaderboard belum selesai');
      }
      const row = await this.repo.findWeekByWeekId(targetWeekId);
      if (!row?.finalizedAt) {
        throw new NotFoundError('LEADERBOARD_WEEK_NOT_FOUND', 'Snapshot minggu ini belum tersedia');
      }
      entries = await this.repo.listEntriesForWeek(targetWeekId);
    }

    return {
      entries,
      meta: {
        week_id: targetWeekId,
        resets_at: formatWibOffset(endedAt),
        metric: 'combined',
        cdn: {
          current: this.storage.currentPublicUrl,
          weekly: this.storage.weeklyPublicUrl(targetWeekId),
        },
      },
    };
  }
}