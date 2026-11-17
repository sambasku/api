import type { LeaderboardStoragePort } from '../ports/leaderboard-storage.port';
import type { LeaderboardRepository } from '../../domain/repositories/leaderboard.repository';
import type { LeaderboardEntry } from '../../domain/entities/leaderboard-entry.entity';
import {
  currentWeekWindow,
  formatWibOffset,
  windowForWeekId,
  weekId as weekIdFromDate,
} from '../../domain/utils/iso-week';
import { toFilePayload } from './leaderboard-payload.utils';

export interface ComputeLiveLeaderboardResult {
  weekId: string;
  startedAt: Date;
  endedAt: Date;
  entries: LeaderboardEntry[];
  publishedUrl: string | null;
}

/**
 * Hitung minggu berjalan dan opsional publikasi `current.json`.
 */
export class ComputeLiveLeaderboardUseCase {
  constructor(
    private readonly repo: LeaderboardRepository,
    private readonly storage: LeaderboardStoragePort,
  ) {}

  async execute(now: Date = new Date(), options?: { publish?: boolean }): Promise<ComputeLiveLeaderboardResult> {
    const window = currentWeekWindow(now);
    const entries = await this.repo.computeScoresForWindow(window.startedAt, window.endedAt);

    await this.repo.upsertWeek({
      weekId: window.weekId,
      startedAt: window.startedAt,
      endedAt: window.endedAt,
      updatedAt: now,
    });

    let publishedUrl: string | null = null;
    if (options?.publish) {
      const payload = toFilePayload({
        weekId: window.weekId,
        startedAt: window.startedAt,
        endedAt: window.endedAt,
        finalized: false,
        entries,
        generatedAt: now,
      });
      const result = await this.storage.publishCurrent(payload);
      publishedUrl = result.url;
      await this.repo.touchWeekUpdatedAt(window.weekId, now);
    }

    return {
      weekId: window.weekId,
      startedAt: window.startedAt,
      endedAt: window.endedAt,
      entries,
      publishedUrl,
    };
  }

  /** Payload untuk minggu arbitrer (mis. setelah finalize untuk minggu baru). */
  async computeForWeekId(targetWeekId: string, now: Date = new Date(), publish = true) {
    const { startedAt, endedAt } = windowForWeekId(targetWeekId);
    const entries = await this.repo.computeScoresForWindow(startedAt, endedAt);
    await this.repo.upsertWeek({
      weekId: targetWeekId,
      startedAt,
      endedAt,
      updatedAt: now,
    });
    let publishedUrl: string | null = null;
    if (publish) {
      const payload = toFilePayload({
        weekId: targetWeekId,
        startedAt,
        endedAt,
        finalized: targetWeekId !== weekIdFromDate(now) && endedAt <= now,
        entries,
        generatedAt: now,
      });
      const result = await this.storage.publishCurrent(payload);
      publishedUrl = result.url;
      await this.repo.touchWeekUpdatedAt(targetWeekId, now);
    }
    return { weekId: targetWeekId, startedAt, endedAt, entries, publishedUrl };
  }

  static resetsAtLabel(endedAt: Date): string {
    return formatWibOffset(endedAt);
  }
}