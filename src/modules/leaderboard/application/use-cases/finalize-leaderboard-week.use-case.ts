import type { AuditLogRepository } from '@/modules/audit/domain/repositories/audit-log.repository';
import { NotFoundError } from '@/shared/errors/app-error';
import type { LeaderboardStoragePort } from '../ports/leaderboard-storage.port';
import type { LeaderboardRepository } from '../../domain/repositories/leaderboard.repository';
import {
  currentWeekWindow,
  parseWeekId,
  windowForWeekId,
  weekId as weekIdFromDate,
} from '../../domain/utils/iso-week';
import { toFilePayload } from './leaderboard-payload.utils';
import type { ComputeLiveLeaderboardUseCase } from './compute-live-leaderboard.use-case';

export interface FinalizeLeaderboardWeekResult {
  weekId: string;
  entryCount: number;
  weeklyUrl: string | null;
  currentUrl: string | null;
}

/**
 * Bekukan snapshot minggu lalu, publikasi weekly + current minggu baru.
 */
export class FinalizeLeaderboardWeekUseCase {
  constructor(
    private readonly repo: LeaderboardRepository,
    private readonly storage: LeaderboardStoragePort,
    private readonly computeLive: ComputeLiveLeaderboardUseCase,
    private readonly auditRepo?: AuditLogRepository,
    /** Opsional: kick scan achievement (leaderboard_top) setelah snapshot baru. */
    private readonly onFinalized?: (weekId: string) => Promise<void>,
  ) {}

  async execute(weekIdInput?: string, now: Date = new Date()): Promise<FinalizeLeaderboardWeekResult> {
    const weekId = weekIdInput ?? this.defaultWeekToFinalize(now);
    try {
      parseWeekId(weekId);
    } catch {
      throw new NotFoundError('LEADERBOARD_WEEK_NOT_FOUND', 'Minggu leaderboard tidak ditemukan');
    }

    const { startedAt, endedAt } = windowForWeekId(weekId);
    if (endedAt > now) {
      throw new NotFoundError('LEADERBOARD_WEEK_NOT_FOUND', 'Minggu leaderboard belum selesai atau tidak ada');
    }

    const existing = await this.repo.findWeekByWeekId(weekId);
    if (existing?.finalizedAt) {
      return {
        weekId,
        entryCount: (await this.repo.listEntriesForWeek(weekId)).length,
        weeklyUrl: existing.publishedUrl,
        currentUrl: this.storage.currentPublicUrl,
      };
    }

    const entries = await this.repo.computeScoresForWindow(startedAt, endedAt);
    await this.repo.upsertWeek({
      weekId,
      startedAt,
      endedAt,
      updatedAt: now,
    });
    await this.repo.replaceEntriesForWeek(weekId, entries);

    const finalizedPayload = toFilePayload({
      weekId,
      startedAt,
      endedAt,
      finalized: true,
      entries,
      generatedAt: now,
    });
    const weeklyPublished = await this.storage.publishWeekly(weekId, finalizedPayload);

    const currentResult = await this.computeLive.computeForWeekId(
      currentWeekWindow(now).weekId,
      now,
      true,
    );

    await this.repo.upsertWeek({
      weekId,
      startedAt,
      endedAt,
      finalizedAt: now,
      publishedUrl: weeklyPublished.url,
      updatedAt: now,
    });

    await this.auditRepo?.record({
      userId: null,
      action: 'publish',
      entityType: 'leaderboard_week',
      entityId: weekId,
      newData: {
        entry_count: entries.length,
        weekly_url: weeklyPublished.url,
        current_url: currentResult.publishedUrl,
      },
    });

    if (this.onFinalized) {
      try {
        await this.onFinalized(weekId);
      } catch (err) {
        // Finalize sudah sukses; scan gagal tidak boleh rollback snapshot.
        console.error(
          JSON.stringify({
            level: 'error',
            msg: 'leaderboard finalize achievement scan failed',
            weekId,
            err: err instanceof Error ? err.message : String(err),
          }),
        );
      }
    }

    return {
      weekId,
      entryCount: entries.length,
      weeklyUrl: weeklyPublished.url,
      currentUrl: currentResult.publishedUrl,
    };
  }

  private defaultWeekToFinalize(now: Date): string {
    const { startedAt } = currentWeekWindow(now);
    const prevInstant = new Date(startedAt.getTime() - 1);
    return weekIdFromDate(prevInstant);
  }
}