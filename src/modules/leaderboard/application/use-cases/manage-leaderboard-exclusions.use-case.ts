import { ForbiddenError, NotFoundError } from '@/shared/errors/app-error';
import { isSystemUserId } from '@/shared/constants/system-users';
import type { AuditLogRepository } from '@/modules/audit/domain/repositories/audit-log.repository';
import type { LeaderboardRepository } from '../../domain/repositories/leaderboard.repository';
import type { ComputeLiveLeaderboardUseCase } from './compute-live-leaderboard.use-case';

export interface LeaderboardExclusionMutationResult {
  excluded: boolean;
  refreshed: boolean;
  current_url: string | null;
  week_id: string | null;
}

export class ManageLeaderboardExclusionsUseCase {
  constructor(
    private readonly repo: LeaderboardRepository,
    private readonly computeLive: ComputeLiveLeaderboardUseCase,
    private readonly auditRepo?: AuditLogRepository,
  ) {}

  async list() {
    return this.repo.listExcludedUsers();
  }

  async add(input: { userId: string; note?: string | null; actorId: string }) {
    const exists = await this.repo.findUserForExclusion(input.userId);
    if (!exists) {
      throw new NotFoundError('USER_NOT_FOUND', 'User tidak ditemukan');
    }
    await this.repo.addExclusion(input.userId, input.note ?? null);
    await this.auditRepo?.record({
      userId: input.actorId,
      action: 'create',
      entityType: 'leaderboard_exclusion',
      entityId: input.userId,
      newData: { user_id: input.userId, note: input.note ?? null },
    });
    return this.refreshAfterChange(true);
  }

  async remove(input: { userId: string; actorId: string }) {
    if (isSystemUserId(input.userId)) {
      throw new ForbiddenError(
        'LEADERBOARD_EXCLUSION_PROTECTED',
        'Akun sistem bawaan tidak bisa dikeluarkan dari daftar exclude.',
      );
    }
    const removed = await this.repo.removeExclusion(input.userId);
    if (!removed) {
      throw new NotFoundError('LEADERBOARD_EXCLUSION_NOT_FOUND', 'User tidak ada di daftar exclude');
    }
    await this.auditRepo?.record({
      userId: input.actorId,
      action: 'delete',
      entityType: 'leaderboard_exclusion',
      entityId: input.userId,
    });
    return this.refreshAfterChange(false);
  }

  private async refreshAfterChange(excluded: boolean): Promise<LeaderboardExclusionMutationResult> {
    try {
      const live = await this.computeLive.execute(new Date(), { publish: true });
      return {
        excluded,
        refreshed: true,
        current_url: live.publishedUrl,
        week_id: live.weekId,
      };
    } catch {
      return {
        excluded,
        refreshed: false,
        current_url: null,
        week_id: null,
      };
    }
  }
}